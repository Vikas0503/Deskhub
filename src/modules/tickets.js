import * as auth from '../api/auth.js';
import * as ticketsApi from '../api/tickets.js';
import { ensureUsersLoaded, displayName, getUserById, listAssignableUsers } from '../api/users.js';
import { debounce } from '../utils/debounce.js';
import {
  applyTicketListQuery,
  buildQueryString,
  DEFAULT_PAGE_SIZE,
  parseTicketListQuery,
} from '../utils/ticketQuery.js';
import { formatDateTime, formatRelative } from '../utils/formatDate.js';
import { attachFormValidation } from './form.js';
import { showToast } from './ui.js';

/** @type {import('../utils/ticketQuery.js').TicketListState} */
const state = {
  q: '',
  status: '',
  priority: '',
  assigneeId: '',
  sort: 'newest',
  page: 1,
  pageSize: DEFAULT_PAGE_SIZE,
};

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
  if (!t || typeof t !== 'object') return '-';
  const o = /** @type {Record<string, unknown>} */ (t);
  const v = o.customer ?? o.customerName;
  return typeof v === 'string' && v.trim() ? v : '-';
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

    const id = t.id != null ? String(t.id) : '-';
    const title = typeof t.title === 'string' ? t.title : '-';
    const customer = ticketCustomer(t);
    const priority = typeof t.priority === 'string' ? t.priority : '-';
    const status = typeof t.status === 'string' ? t.status : '-';
    const assigneeId = ticketAssigneeId(t);
    const assigneeName = displayName(getUserById(assigneeId));
    const createdRaw = ticketCreated(t);
    const created = formatDateTime(createdRaw);
    const createdTitle = created !== '-' ? `Relative: ${formatRelative(createdRaw)}` : '';

    const cells = [
      { text: id },
      { text: title },
      { text: customer },
      { text: priority },
      { text: status },
      { text: assigneeName },
      { text: created, title: createdTitle },
    ];
    tr.dataset.ticketId = id;
    tr.classList.add('tickets-table__row--clickable');
    tr.tabIndex = 0;
    for (const cell of cells) {
      const td = document.createElement('td');
      td.textContent = cell.text;
      if (cell.title) td.title = cell.title;
      tr.appendChild(td);
    }
    tbody.appendChild(tr);
  }
}

/** @param {unknown[]} tickets */
function collectStatuses(tickets) {
  const set = new Set();
  for (const t of tickets) {
    if (t && typeof t === 'object' && typeof /** @type {{ status?: unknown }} */ (t).status === 'string') {
      set.add(/** @type {{ status: string }} */ (t).status);
    }
  }
  return Array.from(set).sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }));
}

/** @param {HTMLSelectElement} filterSelect */
function mergeExtraStatusOptions(filterSelect, tickets) {
  const existing = new Set(
    [...filterSelect.options].map((o) => o.value).filter((v) => v !== ''),
  );
  for (const s of collectStatuses(tickets)) {
    if (!existing.has(s)) {
      const opt = document.createElement('option');
      opt.value = s;
      opt.textContent = s;
      filterSelect.appendChild(opt);
      existing.add(s);
    }
  }
}

/** @param {HTMLSelectElement | null} sel @param {'toolbar' | 'modal'} mode */
function fillAssigneeSelect(sel, mode) {
  if (!sel) return;
  sel.replaceChildren();
  const o0 = document.createElement('option');
  o0.value = '';
  o0.textContent = mode === 'toolbar' ? 'All assignees' : '— Unassigned —';
  sel.appendChild(o0);
  for (const u of listAssignableUsers()) {
    const opt = document.createElement('option');
    opt.value = String(u.id);
    opt.textContent = u.label;
    sel.appendChild(opt);
  }
}

/**
 * @param {{
 *   errorWrap: HTMLElement;
 *   errorMsg: HTMLElement;
 *   loadingEl: HTMLElement;
 *   emptyEl: HTMLElement;
 *   tableWrap: HTMLElement;
 *   tbody: HTMLElement;
 *   searchInput: HTMLInputElement;
 *   filterSelect: HTMLSelectElement;
 *   prioritySelect: HTMLSelectElement;
 *   toolbarAssigneeSelect: HTMLSelectElement | null;
 *   sortSelect: HTMLSelectElement;
 *   assigneeSelect: HTMLSelectElement | null;
 *   paginationEl: HTMLElement;
 *   pagePrev: HTMLButtonElement;
 *   pageNext: HTMLButtonElement;
 *   pageIndicator: HTMLElement;
 *   pageNumbers: HTMLElement;
 * }} ui
 */
function readStateFromDom(ui) {
  state.q = ui.searchInput.value;
  state.status = ui.filterSelect.value;
  state.priority = ui.prioritySelect.value;
  const sortVal = ui.sortSelect.value;
  state.sort = sortVal === 'priority' || sortVal === 'status' ? sortVal : 'newest';
}

function syncUrl() {
  const qs = buildQueryString(state);
  const base = `${window.location.pathname}${window.location.hash || ''}`;
  window.history.replaceState(null, '', qs ? `${base}?${qs}` : base);
}

/**
 * @param {import('../utils/ticketQuery.js').TicketListState} next
 */
function applyParsedUrl(next) {
  state.q = next.q;
  state.status = next.status;
  state.priority = next.priority;
  state.assigneeId = next.assigneeId;
  state.sort = next.sort;
  state.page = next.page;
  state.pageSize = next.pageSize;
}

/**
 * @param {{
 *   errorWrap: HTMLElement;
 *   errorMsg: HTMLElement;
 *   loadingEl: HTMLElement;
 *   emptyEl: HTMLElement;
 *   tableWrap: HTMLElement;
 *   tbody: HTMLElement;
 *   searchInput: HTMLInputElement;
 *   filterSelect: HTMLSelectElement;
 *   prioritySelect: HTMLSelectElement;
 *   toolbarAssigneeSelect: HTMLSelectElement | null;
 *   sortSelect: HTMLSelectElement;
 *   assigneeSelect: HTMLSelectElement | null;
 *   paginationEl: HTMLElement;
 *   pagePrev: HTMLButtonElement;
 *   pageNext: HTMLButtonElement;
 *   pageIndicator: HTMLElement;
 *   pageNumbers: HTMLElement;
 * }} ui
 */
export async function refresh(ui) {
  readStateFromDom(ui);

  const {
    errorWrap,
    errorMsg,
    loadingEl,
    emptyEl,
    tableWrap,
    tbody,
    searchInput,
    filterSelect,
    prioritySelect,
    toolbarAssigneeSelect,
    sortSelect,
    paginationEl,
    pagePrev,
    pageNext,
    pageIndicator,
    pageNumbers,
  } = ui;

  errorWrap.hidden = true;
  loadingEl.hidden = false;
  emptyEl.hidden = true;
  tableWrap.hidden = true;
  paginationEl.hidden = true;
  tbody.replaceChildren();

  try {
    await ensureUsersLoaded();
    fillAssigneeSelect(ui.assigneeSelect, 'modal');
    fillAssigneeSelect(ui.toolbarAssigneeSelect, 'toolbar');

    searchInput.value = state.q;
    filterSelect.value = state.status;
    prioritySelect.value = state.priority;
    sortSelect.value = state.sort;
    if (toolbarAssigneeSelect) {
      const hasOpt = [...toolbarAssigneeSelect.options].some((o) => o.value === state.assigneeId);
      toolbarAssigneeSelect.value = hasOpt ? state.assigneeId : '';
      if (!hasOpt) state.assigneeId = '';
    }

    const data = await ticketsApi.listTickets();
    const allTickets = Array.isArray(data) ? data.map((t) => t) : [];

    mergeExtraStatusOptions(filterSelect, allTickets);

    if (state.status && ![...filterSelect.options].some((o) => o.value === state.status)) {
      const opt = document.createElement('option');
      opt.value = state.status;
      opt.textContent = state.status;
      filterSelect.appendChild(opt);
    }
    filterSelect.value = state.status;

    const result = applyTicketListQuery(allTickets, state);
    state.page = result.page;

    syncUrl();

    if (result.total === 0) {
      loadingEl.hidden = true;
      emptyEl.hidden = false;
      return;
    }

    renderTable(result.items, tbody);
    tableWrap.hidden = false;
    loadingEl.hidden = true;

    pageIndicator.textContent = `Page ${result.page} of ${result.totalPages} (${result.total} tickets)`;
    pagePrev.disabled = result.page <= 1;
    pageNext.disabled = result.page >= result.totalPages;

    pageNumbers.replaceChildren();
    for (let p = 1; p <= result.totalPages; p += 1) {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'tickets-page-btn' + (p === result.page ? ' tickets-page-btn--current' : '');
      btn.textContent = String(p);
      btn.dataset.page = String(p);
      btn.addEventListener('click', () => {
        state.page = p;
        void refresh(ui);
      });
      pageNumbers.appendChild(btn);
    }
    paginationEl.hidden = false;
  } catch (err) {
    loadingEl.hidden = true;
    errorWrap.hidden = false;
    errorMsg.textContent =
      err instanceof Error
        ? err.message
        : 'Could not load tickets. If you use local data, ensure db.json is reachable. If you use json-server, start it and set DESKHUB_USE_REMOTE_API.';
  }
}

export function initTicketsList() {
  if (!auth.isAuthenticated()) {
    window.location.replace('../index.html');
    return;
  }

  applyParsedUrl(parseTicketListQuery(window.location.search));

  const errorWrap = document.getElementById('tickets-error');
  const errorMsg = document.getElementById('tickets-error-message');
  const loadingEl = document.getElementById('tickets-loading');
  const emptyEl = document.getElementById('tickets-empty');
  const tableWrap = document.getElementById('tickets-table-wrap');
  const tbody = document.getElementById('tickets-tbody');
  const retryBtn = document.getElementById('tickets-retry');
  const searchInput = document.getElementById('ticket-search');
  const filterSelect = document.getElementById('ticket-filter');
  const prioritySelect = document.getElementById('ticket-priority-filter');
  const sortSelect = document.getElementById('ticket-sort');
  const toolbarAssigneeSelect = document.getElementById('ticket-assignee-filter');
  const assigneeSelect = document.getElementById('nt-assignee');
  const modal = document.getElementById('ticket-modal');
  const newTicketOpen = document.getElementById('new-ticket-open');
  const newTicketForm = document.getElementById('new-ticket-form');
  const newTicketError = document.getElementById('new-ticket-error');
  const paginationEl = document.getElementById('tickets-pagination');
  const pagePrev = document.getElementById('tickets-page-prev');
  const pageNext = document.getElementById('tickets-page-next');
  const pageIndicator = document.getElementById('tickets-page-indicator');
  const pageNumbers = document.getElementById('tickets-page-numbers');

  if (
    !errorWrap ||
    !errorMsg ||
    !loadingEl ||
    !emptyEl ||
    !tableWrap ||
    !tbody ||
    !retryBtn ||
    !searchInput ||
    !filterSelect ||
    !prioritySelect ||
    !sortSelect ||
    !paginationEl ||
    !(pagePrev instanceof HTMLButtonElement) ||
    !(pageNext instanceof HTMLButtonElement) ||
    !pageIndicator ||
    !pageNumbers
  ) {
    return;
  }

  const ui = {
    errorWrap,
    errorMsg,
    loadingEl,
    emptyEl,
    tableWrap,
    tbody,
    searchInput,
    filterSelect,
    prioritySelect,
    toolbarAssigneeSelect: toolbarAssigneeSelect instanceof HTMLSelectElement ? toolbarAssigneeSelect : null,
    sortSelect,
    assigneeSelect: assigneeSelect instanceof HTMLSelectElement ? assigneeSelect : null,
    paginationEl,
    pagePrev,
    pageNext,
    pageIndicator,
    pageNumbers,
  };

  const titleEl = /** @type {HTMLInputElement | null} */ (newTicketForm?.querySelector('#nt-title'));
  const customerEl = /** @type {HTMLInputElement | null} */ (newTicketForm?.querySelector('#nt-customer'));
  const priorityEl = /** @type {HTMLSelectElement | null} */ (newTicketForm?.querySelector('#nt-priority'));
  const statusEl = /** @type {HTMLSelectElement | null} */ (newTicketForm?.querySelector('#nt-status'));
  const ntSubmit = document.getElementById('nt-submit');

  /** @type {ReturnType<typeof attachFormValidation> | null} */
  let newTicketFormCtrl = null;
  if (
    newTicketForm &&
    titleEl &&
    customerEl &&
    priorityEl &&
    statusEl &&
    ntSubmit instanceof HTMLButtonElement
  ) {
    newTicketFormCtrl = attachFormValidation({
      form: newTicketForm,
      submitButton: ntSubmit,
      fields: [
        {
          name: 'title',
          el: titleEl,
          errorEl: document.getElementById('nt-title-error'),
          rules: [{ rule: 'required' }, { rule: 'minLength', min: 2 }, { rule: 'maxLength', max: 200 }],
        },
        {
          name: 'customer',
          el: customerEl,
          errorEl: document.getElementById('nt-customer-error'),
          rules: [{ rule: 'required' }, { rule: 'minLength', min: 1 }, { rule: 'maxLength', max: 120 }],
        },
        {
          name: 'priority',
          el: priorityEl,
          errorEl: document.getElementById('nt-priority-error'),
          rules: [{ rule: 'oneOf', values: ['low', 'medium', 'high', 'urgent'] }],
        },
        {
          name: 'status',
          el: statusEl,
          errorEl: document.getElementById('nt-status-error'),
          rules: [{ rule: 'oneOf', values: ['open', 'in progress', 'resolved', 'closed'] }],
        },
      ],
    });
  }

  const runRefresh = () => {
    void refresh(ui);
  };

  const debouncedSearchRefresh = debounce(() => {
    void refresh(ui);
  }, 300);

  searchInput.addEventListener('input', () => {
    state.page = 1;
    debouncedSearchRefresh();
  });

  const resetPageAndRefresh = () => {
    state.page = 1;
    void refresh(ui);
  };

  filterSelect.addEventListener('change', resetPageAndRefresh);
  prioritySelect.addEventListener('change', resetPageAndRefresh);
  sortSelect.addEventListener('change', resetPageAndRefresh);
  ui.toolbarAssigneeSelect?.addEventListener('change', () => {
    state.assigneeId = ui.toolbarAssigneeSelect?.value ?? '';
    resetPageAndRefresh();
  });

  pagePrev.addEventListener('click', () => {
    state.page = Math.max(1, state.page - 1);
    void refresh(ui);
  });

  pageNext.addEventListener('click', () => {
    state.page += 1;
    void refresh(ui);
  });

  window.addEventListener('popstate', () => {
    applyParsedUrl(parseTicketListQuery(window.location.search));
    void refresh(ui);
  });

  tbody.addEventListener('click', (e) => {
    const tr = /** @type {HTMLElement | null} */ (
      e.target && 'closest' in e.target ? /** @type {HTMLElement} */ (e.target).closest('tr[data-ticket-id]') : null
    );
    if (!tr || !tbody.contains(tr)) return;
    const tid = tr.dataset.ticketId;
    if (tid && tid !== '-') {
      window.location.assign(`./ticket-detail.html?id=${encodeURIComponent(tid)}`);
    }
  });

  function openModal() {
    if (!modal) return;
    newTicketFormCtrl?.clearErrors();
    if (newTicketError) {
      newTicketError.hidden = true;
      newTicketError.textContent = '';
    }
    modal.hidden = false;
    document.body.classList.add('modal-open');
    newTicketForm?.reset();
    fillAssigneeSelect(ui.assigneeSelect, 'modal');
    newTicketFormCtrl?.updateSubmitDisabled();
  }

  function closeModal() {
    if (!modal) return;
    modal.hidden = true;
    document.body.classList.remove('modal-open');
    if (newTicketError) {
      newTicketError.hidden = true;
      newTicketError.textContent = '';
    }
  }

  newTicketOpen?.addEventListener('click', () => openModal());
  modal?.querySelector('[data-modal-panel]')?.addEventListener('click', (ev) => {
    ev.stopPropagation();
  });
  modal?.querySelectorAll('[data-modal-close]').forEach((el) => {
    el.addEventListener('click', () => closeModal());
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && modal && !modal.hidden) closeModal();
  });

  newTicketForm?.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!newTicketForm || !newTicketError) return;
    newTicketError.hidden = true;
    newTicketError.textContent = '';

    if (newTicketFormCtrl && !newTicketFormCtrl.validateAll()) {
      newTicketError.textContent = 'Fix the highlighted fields and try again.';
      newTicketError.hidden = false;
      return;
    }

    let title;
    let customer;
    let priority;
    let status;
    if (newTicketFormCtrl) {
      const v = newTicketFormCtrl.collectValues();
      title = v.title.trim();
      customer = v.customer.trim();
      priority = v.priority;
      status = v.status;
    } else {
      title = /** @type {HTMLInputElement} */ (newTicketForm.querySelector('#nt-title'))?.value?.trim() ?? '';
      customer = /** @type {HTMLInputElement} */ (newTicketForm.querySelector('#nt-customer'))?.value?.trim() ?? '';
      priority = /** @type {HTMLSelectElement} */ (newTicketForm.querySelector('#nt-priority'))?.value ?? 'medium';
      status = /** @type {HTMLSelectElement} */ (newTicketForm.querySelector('#nt-status'))?.value ?? 'open';
    }
    const assigneeRaw = ui.assigneeSelect?.value ?? '';

    if (!title || !customer) {
      newTicketError.textContent = 'Title and customer are required.';
      newTicketError.hidden = false;
      return;
    }

    /** @type {Record<string, unknown>} */
    const payload = { title, customer, priority, status };
    if (assigneeRaw !== '') {
      const aid = Number(assigneeRaw);
      if (Number.isFinite(aid)) payload.assigneeId = aid;
    }

    try {
      await ticketsApi.createTicket(payload);
      newTicketForm.reset();
      fillAssigneeSelect(ui.assigneeSelect, 'modal');
      newTicketFormCtrl?.clearErrors();
      newTicketFormCtrl?.updateSubmitDisabled();
      closeModal();
      state.page = 1;
      await refresh(ui);
      showToast('Ticket created', { variant: 'success' });
    } catch (err) {
      newTicketError.textContent = err instanceof Error ? err.message : 'Could not create ticket.';
      newTicketError.hidden = false;
      showToast(newTicketError.textContent, { variant: 'error' });
    }
  });

  retryBtn.addEventListener('click', (ev) => {
    ev.preventDefault();
    runRefresh();
  });

  void refresh(ui);
}
