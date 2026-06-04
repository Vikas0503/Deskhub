import { get, post, patch, request } from './client.js';
import { loadLocalDb } from './localDb.js';
import { useRemoteApi } from './mode.js';

/**
 * @param {Record<string, string | number | boolean | undefined>} [query]
 * @returns {Promise<unknown>}
 */
export async function listTickets(query) {
  if (!useRemoteApi()) {
    const db = await loadLocalDb();
    let list = db.tickets.map((t) => t);
    if (query && Object.keys(query).length > 0) {
      const q = query.q ?? query.title_like;
      if (typeof q === 'string' && q.trim()) {
        const s = q.trim().toLowerCase();
        list = list.filter(
          (t) => t && typeof t === 'object' && String(/** @type {{ title?: unknown }} */ (t).title).toLowerCase().includes(s),
        );
      }
    }
    return list;
  }

  if (!query || Object.keys(query).length === 0) {
    return get('/tickets');
  }
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(query)) {
    if (v === undefined || v === '') continue;
    sp.set(k, String(v));
  }
  const qs = sp.toString();
  return get(qs ? `/tickets?${qs}` : '/tickets');
}

/** @param {string | number} id */
export async function getTicket(id) {
  if (!useRemoteApi()) {
    const db = await loadLocalDb();
    const n = Number(id);
    const t = db.tickets.find((x) => x && typeof x === 'object' && Number(/** @type {{ id?: unknown }} */ (x).id) === n);
    if (!t) {
      throw new Error('Ticket not found');
    }
    return t;
  }
  return get(`/tickets/${id}`);
}

/** @param {unknown} body */
export async function createTicket(body) {
  if (!useRemoteApi()) {
    throw new Error('Local mode is read-only for writes. Set window.DESKHUB_USE_REMOTE_API = true and run the API.');
  }
  return post('/tickets', body);
}

/**
 * @param {string | number} id
 * @param {unknown} body
 */
export async function updateTicket(id, body) {
  if (!useRemoteApi()) {
    throw new Error('Local mode is read-only for writes. Set window.DESKHUB_USE_REMOTE_API = true and run the API.');
  }
  return patch(`/tickets/${id}`, body);
}

/** @param {string | number} id */
export async function deleteTicket(id) {
  if (!useRemoteApi()) {
    throw new Error('Local mode is read-only for writes. Set window.DESKHUB_USE_REMOTE_API = true and run the API.');
  }
  return request('DELETE', `/tickets/${id}`);
}

/** @param {string | number} ticketId */
export async function listComments(ticketId) {
  if (!useRemoteApi()) {
    const db = await loadLocalDb();
    const tid = String(ticketId);
    return db.comments.filter(
      (c) => c && typeof c === 'object' && String(/** @type {{ ticketId?: unknown }} */ (c).ticketId) === tid,
    );
  }
  return get(`/comments?ticketId=${encodeURIComponent(String(ticketId))}`);
}

/** @param {unknown} body */
export async function addComment(body) {
  if (!useRemoteApi()) {
    throw new Error('Local mode is read-only for writes. Set window.DESKHUB_USE_REMOTE_API = true and run the API.');
  }
  return post('/comments', body);
}
