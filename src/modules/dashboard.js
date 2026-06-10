/**
 * Dashboard: ticket counts (four summary cards) and a short “recent tickets” list.
 * Uses one `listTickets()` call; each stat is just a filtered count in memory.
 */
import * as ticketsApi from '../api/tickets.js';
import { showPageLoader, hidePageLoader } from './ui.js';

const TICKETS_LIST_URL = './public/tickets.html';

/** Normalised status string for comparisons. */
function ticketStatusLower(t) {
  if (!t || typeof t !== 'object') return '';
  const s = /** @type {{ status?: unknown }} */ (t).status;
  return typeof s === 'string' ? s.trim().toLowerCase() : '';
}

/** Timestamp used to sort “most recent” tickets. */
function ticketCreatedMs(t) {
  if (!t || typeof t !== 'object') return 0;
  const o = /** @type {Record<string, unknown>} */ (t);
  const raw = o.createdAt ?? o.created;
  if (typeof raw !== 'string') return 0;
  const ms = Date.parse(raw);
  return Number.isFinite(ms) ? ms : 0;
}

function countOpen(tickets) {
  return tickets.filter((t) => ticketStatusLower(t) === 'open').length;
}

function countInProgress(tickets) {
  return tickets.filter((t) => {
    const s = ticketStatusLower(t);
    return s === 'in progress' || s === 'in-progress';
  }).length;
}

/** “Done” pipeline: resolved or closed (matches the `status=done` filter on the list page). */
function countResolvedOrClosed(tickets) {
  return tickets.filter((t) => {
    const s = ticketStatusLower(t);
    return s === 'resolved' || s === 'closed';
  }).length;
}

/** Newest first, then take five. */
function fiveMostRecentTickets(tickets) {
  const objectsOnly = tickets.filter((t) => t && typeof t === 'object');
  return [...objectsOnly].sort((a, b) => ticketCreatedMs(b) - ticketCreatedMs(a)).slice(0, 5);
}

/**
 * @param {HTMLElement} listEl
 * @param {{ total: number; open: number; inProgress: number; resolvedOrClosed: number }} counts
 */
function renderStatCards(listEl, counts) {
  listEl.replaceChildren();

  /** One clickable stat card linking to the filtered ticket list. */
  function addCard(href, count, label) {
    const li = document.createElement('li');
    const link = document.createElement('a');
    link.href = href;
    link.className = 'stat-card';

    const value = document.createElement('span');
    value.className = 'stat-card__value';
    value.textContent = String(count);

    const caption = document.createElement('span');
    caption.className = 'stat-card__label';
    caption.textContent = label;

    link.appendChild(value);
    link.appendChild(caption);
    li.appendChild(link);
    listEl.appendChild(li);
  }

  addCard(TICKETS_LIST_URL, counts.total, 'Total');
  addCard(`${TICKETS_LIST_URL}?status=${encodeURIComponent('open')}`, counts.open, 'Open');
  addCard(
    `${TICKETS_LIST_URL}?status=${encodeURIComponent('in progress')}`,
    counts.inProgress,
    'In progress',
  );
  addCard(
    `${TICKETS_LIST_URL}?status=${encodeURIComponent('done')}`,
    counts.resolvedOrClosed,
    'Resolved + closed',
  );
}

/**
 * @param {HTMLElement | null} container
 * @param {HTMLElement | null} emptyEl
 * @param {unknown[]} tickets
 */
function renderRecentTickets(container, emptyEl, tickets) {
  if (!container) return;
  container.replaceChildren();

  const recent = fiveMostRecentTickets(tickets);
  if (recent.length === 0) {
    if (emptyEl) emptyEl.hidden = false;
    return;
  }
  if (emptyEl) emptyEl.hidden = true;

  const ul = document.createElement('ul');
  ul.className = 'dashboard-recent__list';

  for (const raw of recent) {
    if (!raw || typeof raw !== 'object') continue;
    const t = /** @type {Record<string, unknown>} */ (raw);
    const id = t.id != null ? String(t.id) : '';
    const title = typeof t.title === 'string' ? t.title : 'Ticket';

    const li = document.createElement('li');
    const link = document.createElement('a');
    link.className = 'dashboard-recent__link';
    link.href = `${TICKETS_LIST_URL}?ticket=${encodeURIComponent(id)}`;

    const idLabel = document.createElement('strong');
    idLabel.textContent = id ? `#${id}` : '—';

    const titleSpan = document.createElement('span');
    titleSpan.className = 'dashboard-recent__title';
    titleSpan.textContent = title;

    link.appendChild(idLabel);
    link.appendChild(document.createTextNode(' '));
    link.appendChild(titleSpan);
    li.appendChild(link);
    ul.appendChild(li);
  }

  container.appendChild(ul);
}

export function initDashboard() {
  const listEl = document.getElementById('dashboard-stats-list');
  const loadingEl = document.getElementById('dashboard-stats-loading');
  const errorEl = document.getElementById('dashboard-stats-error');
  const recentWrap = document.getElementById('dashboard-recent');
  const recentEmpty = document.getElementById('dashboard-recent-empty');
  if (!listEl || !loadingEl) return;

  loadingEl.hidden = false;
  if (errorEl) {
    errorEl.hidden = true;
    errorEl.textContent = '';
  }
  listEl.hidden = true;
  listEl.replaceChildren();
  if (recentWrap) recentWrap.replaceChildren();
  if (recentEmpty) recentEmpty.hidden = true;

  showPageLoader('Loading dashboard…');

  void ticketsApi
    .listTickets()
    .then((data) => {
      const tickets = Array.isArray(data) ? data : [];
      const objectsOnly = tickets.filter((t) => t && typeof t === 'object');

      const counts = {
        total: objectsOnly.length,
        open: countOpen(objectsOnly),
        inProgress: countInProgress(objectsOnly),
        resolvedOrClosed: countResolvedOrClosed(objectsOnly),
      };

      loadingEl.hidden = true;
      hidePageLoader();
      renderStatCards(listEl, counts);
      listEl.hidden = false;
      renderRecentTickets(recentWrap, recentEmpty, tickets);
    })
    .catch((err) => {
      loadingEl.hidden = true;
      hidePageLoader();
      if (errorEl) {
        errorEl.hidden = false;
        errorEl.textContent =
          err instanceof Error ? err.message : 'Could not load ticket counts. Try again later.';
      }
    });
}
