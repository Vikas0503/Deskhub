import { get, post, patch, request } from './client.js';
import * as persist from './localPersist.js';
import { useRemoteApi } from './mode.js';

/**
 * @param {Record<string, string | number | boolean | undefined>} [query]
 * @returns {Promise<unknown>}
 */
export async function listTickets(query) {
  if (!useRemoteApi()) {
    let list = await persist.getTickets();
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
    const tickets = await persist.getTickets();
    const n = Number(id);
    const t = tickets.find((x) => x && typeof x === 'object' && Number(/** @type {{ id?: unknown }} */ (x).id) === n);
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
    const tickets = await persist.getTickets();
    const ids = tickets.map((t) => Number(/** @type {{ id?: unknown }} */ (t).id)).filter(Number.isFinite);
    const nextId = (ids.length ? Math.max(...ids) : 0) + 1;
    const now = new Date().toISOString();
    const b = body && typeof body === 'object' ? /** @type {Record<string, unknown>} */ (body) : {};
    const newTicket = {
      ...b,
      id: nextId,
      createdAt: b.createdAt ?? now,
      updatedAt: b.updatedAt ?? now,
    };
    tickets.push(newTicket);
    persist.persistTickets(tickets);
    return newTicket;
  }
  return post('/tickets', body);
}

/**
 * @param {string | number} id
 * @param {unknown} body
 */
export async function updateTicket(id, body) {
  if (!useRemoteApi()) {
    const tickets = await persist.getTickets();
    const n = Number(id);
    const idx = tickets.findIndex((x) => x && typeof x === 'object' && Number(/** @type {{ id?: unknown }} */ (x).id) === n);
    if (idx === -1) throw new Error('Ticket not found');
    const cur = /** @type {Record<string, unknown>} */ (tickets[idx]);
    const patchObj = body && typeof body === 'object' ? /** @type {Record<string, unknown>} */ (body) : {};
    tickets[idx] = {
      ...cur,
      ...patchObj,
      id: cur.id,
      updatedAt: new Date().toISOString(),
    };
    persist.persistTickets(tickets);
    return tickets[idx];
  }
  return patch(`/tickets/${id}`, body);
}

/** @param {string | number} id */
export async function deleteTicket(id) {
  if (!useRemoteApi()) {
    const n = Number(id);
    const tickets = (await persist.getTickets()).filter(
      (x) => !(x && typeof x === 'object' && Number(/** @type {{ id?: unknown }} */ (x).id) === n),
    );
    const comments = (await persist.getComments()).filter(
      (c) => !(c && typeof c === 'object' && Number(/** @type {{ ticketId?: unknown }} */ (c).ticketId) === n),
    );
    persist.persistTickets(tickets);
    persist.persistComments(comments);
    return null;
  }
  return request('DELETE', `/tickets/${id}`);
}

/** @param {string | number} ticketId */
export async function listComments(ticketId) {
  if (!useRemoteApi()) {
    const want = String(ticketId);
    const all = await persist.getComments();
    return all.filter((c) => {
      if (!c || typeof c !== 'object') return false;
      const raw = /** @type {{ ticketId?: unknown }} */ (c).ticketId;
      return String(raw) === want;
    });
  }
  return get(`/comments?ticketId=${encodeURIComponent(String(ticketId))}`);
}

/** @param {unknown} body */
export async function addComment(body) {
  if (!useRemoteApi()) {
    const b = body && typeof body === 'object' ? /** @type {Record<string, unknown>} */ (body) : {};
    const ticketId = b.ticketId;
    if (ticketId == null) throw new Error('ticketId is required');
    const comments = await persist.getComments();
    const ids = comments.map((c) => Number(/** @type {{ id?: unknown }} */ (c).id)).filter(Number.isFinite);
    const nextId = (ids.length ? Math.max(...ids) : 0) + 1;
    const row = {
      ...b,
      id: nextId,
      ticketId: Number(ticketId),
      createdAt: b.createdAt ?? new Date().toISOString(),
    };
    comments.push(row);
    persist.persistComments(comments);
    return row;
  }
  return post('/comments', body);
}
