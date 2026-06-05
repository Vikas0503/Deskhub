import { get } from './client.js';
import { getMergedUsers } from './localPersist.js';
import { useRemoteApi } from './mode.js';

/** @type {unknown[] | null} */
let cache = null;

/** @type {Promise<unknown[]> | null} */
let inflight = null;

export function clearUsersCache() {
  cache = null;
  inflight = null;
}

/** Fetch `/users` once (remote) or merged users from seed + registrations (local). */
export async function ensureUsersLoaded() {
  if (!useRemoteApi()) {
    cache = await getMergedUsers();
    return cache;
  }

  if (cache) return cache;
  if (!inflight) {
    inflight = get('/users')
      .then((users) => {
        cache = Array.isArray(users) ? users : [];
        inflight = null;
        return cache;
      })
      .catch((err) => {
        inflight = null;
        throw err;
      });
  }
  return inflight;
}

/** @param {string | number | null | undefined} id */
export function getUserById(id) {
  if (cache == null || id == null || id === '') return null;
  return cache.find((u) => String(/** @type {{ id?: unknown }} */ (u).id) === String(id)) ?? null;
}

/** @param {unknown} user */
export function displayName(user) {
  if (!user || typeof user !== 'object') return '—';
  const u = /** @type {{ name?: unknown, email?: unknown, id?: unknown }} */ (user);
  if (typeof u.name === 'string' && u.name.trim()) return u.name.trim();
  if (typeof u.email === 'string' && u.email.trim()) return u.email.trim();
  if (u.id != null) return `#${u.id}`;
  return '—';
}

/** @returns {{ id: unknown, label: string }[]} */
export function listAssignableUsers() {
  if (!cache) return [];
  return cache
    .filter((u) => u && typeof u === 'object')
    .map((u) => ({ id: /** @type {{ id?: unknown }} */ (u).id, label: displayName(u) }));
}
