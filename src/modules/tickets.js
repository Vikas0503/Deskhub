import * as auth from '../api/auth.js';
import * as ticketsApi from '../api/tickets.js';
import { ensureUsersLoaded, displayName, getUserById } from '../api/users.js';
import { formatDateTime } from '../utils/formatDate.js';

/** @param {unknown} t */
function ticketAssigneeId(t) {
  if (!t || typeof t !== 'object') return null;
  const o = /** @type {Record<string, unknown>} */ (t);
  if (o.assigneeId != null) return o.assigneeId;
  if (o.assignee != null && typeof o.assignee === 'object' && 'id' in /** @type {object} */ (o.assignee)) {
    return /** @type {{ id: unknown }} */ (o.assignee).id;
  }
  return null;
}

/** @param {unknown} t */
function ticketCustomer(t) {
  if (!t || typeof t !== 'object') return '—';
  const o = /** @type {Record<string, unknown>} */ (t);
  const v = o.customer ?? o.customerName;
  return typeof v === 'string' && v.trim() ? v : '—';
}

/** @param {unknown} t */
function ticketCreated(t) {
  if (!t || typeof t !== 'object') return null;
  const o = /** @type {Record<string, unknown>} */ (t);
  return o.createdAt ?? o.created ?? null;
}

/**
 * @param {unknown[]} list
 * @param {HTMLElement} tbody
 */
export function renderTable(list, tbody) {
  tbody.replaceChildren();

  for (const raw of list) {
    if (!raw || typeof raw !== 'object') continue;
    const t = /** @type {Record<string, unknown>} */ (raw);
    const tr = document.createElement('tr');

    const id = t.id != null ? String(t.id) : '—';
    const title = typeof t.title === 'string' ? t.title : '—';
    const customer = ticketCustomer(t);
    const priority = typeof t.priority === 'string' ? t.priority : '—';
    const status = typeof t.status === 'string' ? t.status : '—';
    const assigneeId = ticketAssigneeId(t);
    const assigneeName = displayName(getUserById(assigneeId));
    const created = formatDateTime(ticketCreated(t));

    const cells = [id, title, customer, priority, status, assigneeName, created];
    for (const text of cells) {
      const td = document.createElement('td');
      td.textContent = text;
      tr.appendChild(td);
    }
    tbody.appendChild(tr);
  }
}

/**
 * @param {{
 *   loadingEl: HTMLElement;
 *   errorWrap: HTMLElement;
 *   errorMsg: HTMLElement;
 *   emptyEl: HTMLElement;
 *   tableWrap: HTMLElement;
 *   tbody: HTMLElement;
 * }} ui
 */
export async function refresh(ui) {
  const { loadingEl, errorWrap, errorMsg, emptyEl, tableWrap, tbody } = ui;

  loadingEl.hidden = false;
  errorWrap.hidden = true;
  emptyEl.hidden = true;
  tableWrap.hidden = true;

  try {
    await ensureUsersLoaded();
    const data = await ticketsApi.listTickets();
    const list = Array.isArray(data) ? data : [];

    loadingEl.hidden = true;

    if (list.length === 0) {
      emptyEl.hidden = false;
      return;
    }

    renderTable(list, tbody);
    tableWrap.hidden = false;
  } catch (err) {
    loadingEl.hidden = true;
    errorWrap.hidden = false;
    errorMsg.textContent =
      err instanceof Error ? err.message : 'Could not reach the server. Is json-server running on port 3001?';
  }
}

export function initTicketsList() {
  if (!auth.isAuthenticated()) {
    window.location.replace('../index.html');
    return;
  }

  const loadingEl = document.getElementById('tickets-loading');
  const errorWrap = document.getElementById('tickets-error');
  const errorMsg = document.getElementById('tickets-error-message');
  const emptyEl = document.getElementById('tickets-empty');
  const tableWrap = document.getElementById('tickets-table-wrap');
  const tbody = document.getElementById('tickets-tbody');
  const retryBtn = document.getElementById('tickets-retry');

  if (!loadingEl || !errorWrap || !errorMsg || !emptyEl || !tableWrap || !tbody || !retryBtn) {
    return;
  }

  const ui = { loadingEl, errorWrap, errorMsg, emptyEl, tableWrap, tbody };

  retryBtn.addEventListener('click', () => {
    void refresh(ui);
  });

  void refresh(ui);
}
