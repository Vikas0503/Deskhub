/** @typedef {'newest' | 'priority' | 'status'} TicketSort */

/**
 * @typedef {{
 *   q: string;
 *   status: string;
 *   priority: string;
 *   assigneeId: string;
 *   sort: TicketSort;
 *   page: number;
 *   pageSize: number;
 * }} TicketListState
 */

export const DEFAULT_PAGE_SIZE = 10;

const PRIORITY_RANK = /** @type {Record<string, number>} */ ({
  urgent: 4,
  high: 3,
  medium: 2,
  low: 1,
});

/** @param {unknown} t */
function assigneeIdFromTicket(t) {
  if (!t || typeof t !== 'object') return null;
  const o = /** @type {Record<string, unknown>} */ (t);
  if (o.assigneeId != null) return o.assigneeId;
  if (o.assignee != null && typeof o.assignee === 'object' && 'id' in /** @type {object} */ (o.assignee)) {
    return /** @type {{ id: unknown }} */ (o.assignee).id;
  }
  return null;
}

/** @param {unknown} t */
function customerLower(t) {
  if (!t || typeof t !== 'object') return '';
  const o = /** @type {Record<string, unknown>} */ (t);
  const v = o.customer ?? o.customerName;
  return typeof v === 'string' ? v.toLowerCase() : '';
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

/** @param {unknown} t */
function priorityRank(t) {
  if (!t || typeof t !== 'object') return 0;
  const p = /** @type {Record<string, unknown>} */ (t).priority;
  if (typeof p !== 'string') return 0;
  return PRIORITY_RANK[p.toLowerCase()] ?? 0;
}

/** @param {unknown} t */
function statusStr(t) {
  if (!t || typeof t !== 'object') return '';
  const s = /** @type {Record<string, unknown>} */ (t).status;
  return typeof s === 'string' ? s.toLowerCase() : '';
}

/**
 * Builds a query string for URL sync (and optional server use). Skips empty values.
 * @param {TicketListState} state
 */
export function buildQueryString(state) {
  const sp = new URLSearchParams();
  const q = (state.q || '').trim();
  if (q) sp.set('q', q);
  if (state.status) sp.set('status', state.status);
  if (state.priority) sp.set('priority', state.priority);
  if (state.assigneeId) sp.set('assigneeId', String(state.assigneeId));
  if (state.sort && state.sort !== 'newest') sp.set('sort', state.sort);
  if (state.page > 1) sp.set('page', String(state.page));
  if (state.pageSize !== DEFAULT_PAGE_SIZE) sp.set('pageSize', String(state.pageSize));
  return sp.toString();
}

/** @param {string | undefined} raw */
function normalizeSort(raw) {
  if (raw === 'priority' || raw === 'status') return /** @type {TicketSort} */ (raw);
  return /** @type {TicketSort} */ ('newest');
}

/**
 * @param {string} search — `window.location.search` style, leading `?` optional
 * @returns {TicketListState}
 */
export function parseTicketListQuery(search) {
  const s = search.startsWith('?') ? search : `?${search}`;
  const sp = new URLSearchParams(s);
  const pageRaw = sp.get('page');
  const pageNum = pageRaw != null ? Number.parseInt(pageRaw, 10) : 1;
  const psRaw = sp.get('pageSize');
  const pageSizeNum = psRaw != null ? Number.parseInt(psRaw, 10) : DEFAULT_PAGE_SIZE;
  return {
    q: sp.get('q') ?? '',
    status: sp.get('status') ?? '',
    priority: sp.get('priority') ?? '',
    assigneeId: sp.get('assigneeId') ?? '',
    sort: normalizeSort(sp.get('sort') ?? undefined),
    page: Number.isFinite(pageNum) && pageNum >= 1 ? pageNum : 1,
    pageSize: Number.isFinite(pageSizeNum) && pageSizeNum >= 1 ? pageSizeNum : DEFAULT_PAGE_SIZE,
  };
}

/**
 * @param {unknown[]} allTickets
 * @param {TicketListState} state
 * @returns {{ items: unknown[]; total: number; page: number; totalPages: number }}
 */
export function applyTicketListQuery(allTickets, state) {
  let list = allTickets.filter((t) => t && typeof t === 'object');

  const q = (state.q || '').trim().toLowerCase();
  if (q) {
    list = list.filter((raw) => {
      const t = /** @type {Record<string, unknown>} */ (raw);
      const title = typeof t.title === 'string' ? t.title.toLowerCase() : '';
      const cust = customerLower(raw);
      const idStr = t.id != null ? String(t.id) : '';
      return title.includes(q) || cust.includes(q) || idStr.includes(q);
    });
  }

  if (state.status) {
    const want = state.status.trim().toLowerCase();
    list = list.filter((raw) => statusStr(raw) === want);
  }

  if (state.priority) {
    const want = state.priority.trim().toLowerCase();
    list = list.filter((raw) => {
      if (!raw || typeof raw !== 'object') return false;
      const p = /** @type {Record<string, unknown>} */ (raw).priority;
      return typeof p === 'string' && p.toLowerCase() === want;
    });
  }

  if (state.assigneeId) {
    const want = String(state.assigneeId);
    list = list.filter((raw) => String(assigneeIdFromTicket(raw) ?? '') === want);
  }

  if (state.sort === 'priority') {
    list = [...list].sort((a, b) => priorityRank(b) - priorityRank(a) || createdMs(b) - createdMs(a));
  } else if (state.sort === 'status') {
    list = [...list].sort((a, b) => {
      const cmp = statusStr(a).localeCompare(statusStr(b), undefined, { sensitivity: 'base' });
      return cmp !== 0 ? cmp : createdMs(b) - createdMs(a);
    });
  } else {
    list = [...list].sort((a, b) => createdMs(b) - createdMs(a));
  }

  const total = list.length;
  const pageSize = state.pageSize > 0 ? state.pageSize : DEFAULT_PAGE_SIZE;
  const page = state.page > 0 ? state.page : 1;
  const totalPages = total === 0 ? 1 : Math.max(1, Math.ceil(total / pageSize));
  const safePage = Math.min(page, totalPages);
  const start = (safePage - 1) * pageSize;
  const items = list.slice(start, start + pageSize);

  return { items, total, page: safePage, totalPages };
}
