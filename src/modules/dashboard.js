import * as ticketsApi from '../api/tickets.js';
import { showPageLoader, hidePageLoader } from './ui.js';

const TICKETS_BASE = './public/tickets.html';
const DETAIL_BASE = './public/ticket-detail.html';

/** @param {unknown} t */
function statusLower(t) {
  if (!t || typeof t !== 'object') return '';
  const s = /** @type {{ status?: unknown }} */ (t).status;
  return typeof s === 'string' ? s.trim().toLowerCase() : '';
}

/** @param {unknown} t */
function createdMs(t) {
  if (!t || typeof t !== 'object') return 0;
  const o = /** @type {Record<string, unknown>} */ (t);
  const raw = o.createdAt ?? o.created;
  if (typeof raw !== 'string') return 0;
  const ms = Date.parse(raw);
  return Number.isFinite(ms) ? ms : 0;
}

/**
 * Four “virtual” filtered counts in parallel (Day 32). One list fetch; counts match filter semantics.
 * When wired to a real API with `X-Total-Count`, replace each branch with `GET /tickets?...` + header.
 * @param {unknown[]} tickets
 */
async function computeDashboardCounts(tickets) {
  const arr = tickets.filter((t) => t && typeof t === 'object');

  return Promise.all([
    Promise.resolve(arr.length),
    Promise.resolve(arr.filter((t) => statusLower(t) === 'open').length),
    Promise.resolve(
      arr.filter((t) => {
        const s = statusLower(t);
        return s === 'in progress' || s === 'in-progress';
      }).length,
    ),
    Promise.resolve(
      arr.filter((t) => {
        const s = statusLower(t);
        return s === 'resolved' || s === 'closed';
      }).length,
    ),
  ]);
}

/**
 * @param {unknown[]} tickets
 * @returns {unknown[]}
 */
function recentFiveTickets(tickets) {
  const arr = tickets.filter((t) => t && typeof t === 'object');
  return [...arr].sort((a, b) => createdMs(b) - createdMs(a)).slice(0, 5);
}

/**
 * @param {HTMLElement} listEl
 * @param {number} total
 * @param {number} open
 * @param {number} inProgress
 * @param {number} resolved
 */
function renderFourStatCards(listEl, total, open, inProgress, resolved) {
  listEl.replaceChildren();

  /** @param {string} href @param {string} value @param {string} label */
  function addLinkCard(href, value, label) {
    const li = document.createElement('li');
    const a = document.createElement('a');
    a.href = href;
    a.className = 'stat-card';
    const val = document.createElement('span');
    val.className = 'stat-card__value';
    val.textContent = value;
    const lab = document.createElement('span');
    lab.className = 'stat-card__label';
    lab.textContent = label;
    a.appendChild(val);
    a.appendChild(lab);
    li.appendChild(a);
    listEl.appendChild(li);
  }

  addLinkCard(TICKETS_BASE, String(total), 'Total');
  addLinkCard(`${TICKETS_BASE}?status=${encodeURIComponent('open')}`, String(open), 'Open');
  addLinkCard(`${TICKETS_BASE}?status=${encodeURIComponent('in progress')}`, String(inProgress), 'In progress');
  addLinkCard(`${TICKETS_BASE}?status=${encodeURIComponent('done')}`, String(resolved), 'Resolved + closed');
}

/**
 * @param {HTMLElement | null} container
 * @param {HTMLElement | null} emptyEl
 * @param {unknown[]} tickets
 */
function renderRecentTickets(container, emptyEl, tickets) {
  if (!container) return;
  container.replaceChildren();
  const recent = recentFiveTickets(tickets);
  if (recent.length === 0) {
    if (emptyEl) {
      emptyEl.hidden = false;
    }
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
    const a = document.createElement('a');
    a.className = 'dashboard-recent__link';
    a.href = `${DETAIL_BASE}?id=${encodeURIComponent(id)}`;
    const strong = document.createElement('strong');
    strong.textContent = id ? `#${id}` : '—';
    const span = document.createElement('span');
    span.className = 'dashboard-recent__title';
    span.textContent = title;
    a.appendChild(strong);
    a.appendChild(document.createTextNode(' '));
    a.appendChild(span);
    li.appendChild(a);
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
    .then(async (data) => {
      const tickets = Array.isArray(data) ? data : [];
      const [total, open, inProgress, resolved] = await computeDashboardCounts(tickets);
      loadingEl.hidden = true;
      hidePageLoader();
      renderFourStatCards(listEl, total, open, inProgress, resolved);
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
