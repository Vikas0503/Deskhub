import * as ticketsApi from '../api/tickets.js';

const TICKETS_BASE = './public/tickets.html';

/**
 * @param {unknown[]} tickets
 * @returns {Map<string, { canonical: string; count: number }>}
 */
function countByStatus(tickets) {
  /** @type {Map<string, { canonical: string; count: number }>} */
  const byLower = new Map();
  for (const raw of tickets) {
    if (!raw || typeof raw !== 'object') continue;
    const st = /** @type {{ status?: unknown }} */ (raw).status;
    const s = typeof st === 'string' && st.trim() ? st.trim() : '';
    const key = s ? s.toLowerCase() : '__none__';
    const canonical = s || 'Unspecified';
    const prev = byLower.get(key);
    if (!prev) {
      byLower.set(key, { canonical, count: 1 });
    } else {
      prev.count += 1;
    }
  }
  return byLower;
}

/**
 * @param {HTMLElement} listEl
 * @param {unknown[]} tickets
 */
function renderStatGrid(listEl, tickets) {
  listEl.replaceChildren();
  const total = tickets.length;
  const map = countByStatus(tickets);

  const entries = Array.from(map.entries())
    .filter(([k]) => k !== '__none__')
    .map(([, v]) => v)
    .sort((a, b) => a.canonical.localeCompare(b.canonical, undefined, { sensitivity: 'base' }));

  const unspecified = map.get('__none__');

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

  addLinkCard(TICKETS_BASE, String(total), 'All tickets');

  for (const { canonical, count } of entries) {
    const href = `${TICKETS_BASE}?status=${encodeURIComponent(canonical)}`;
    addLinkCard(href, String(count), canonical);
  }

  if (unspecified && unspecified.count > 0) {
    const li = document.createElement('li');
    const div = document.createElement('div');
    div.className = 'stat-card stat-card--muted';
    div.setAttribute('role', 'group');
    div.setAttribute('aria-label', 'Tickets without a status');
    const val = document.createElement('span');
    val.className = 'stat-card__value';
    val.textContent = String(unspecified.count);
    const lab = document.createElement('span');
    lab.className = 'stat-card__label';
    lab.textContent = 'Unspecified status';
    const hint = document.createElement('span');
    hint.className = 'stat-card__hint';
    hint.textContent = 'Assign a status on each ticket to filter them here.';
    div.appendChild(val);
    div.appendChild(lab);
    div.appendChild(hint);
    li.appendChild(div);
    listEl.appendChild(li);
  }
}

export function initDashboard() {
  const listEl = document.getElementById('dashboard-stats-list');
  const loadingEl = document.getElementById('dashboard-stats-loading');
  const errorEl = document.getElementById('dashboard-stats-error');
  if (!listEl || !loadingEl) return;

  loadingEl.hidden = false;
  if (errorEl) {
    errorEl.hidden = true;
    errorEl.textContent = '';
  }
  listEl.hidden = true;
  listEl.replaceChildren();

  void ticketsApi
    .listTickets()
    .then((data) => {
      const tickets = Array.isArray(data) ? data : [];
      loadingEl.hidden = true;
      renderStatGrid(listEl, tickets);
      listEl.hidden = false;
    })
    .catch((err) => {
      loadingEl.hidden = true;
      if (errorEl) {
        errorEl.hidden = false;
        errorEl.textContent =
          err instanceof Error ? err.message : 'Could not load ticket counts. Try again later.';
      }
    });
}
