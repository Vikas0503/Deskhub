/**
 * Loads `db.json` from the same origin as the page (no separate API process).
 * Uses `location.href` so paths work from `/index.html`, `/public/tickets.html`, etc.
 */

/** @type {{ users: unknown[]; tickets: unknown[]; comments: unknown[] } | null} */
let cache = null;

/** @type {Promise<{ users: unknown[]; tickets: unknown[]; comments: unknown[] }> | null} */
let inflight = null;

const FETCH_MS = 12000;

/** Resolve db.json URL for static hosting (root vs /public/, GitHub Pages project site, etc.). */
export function resolveDbJsonUrl() {
  if (typeof globalThis.DESKHUB_DB_JSON_URL === 'string' && globalThis.DESKHUB_DB_JSON_URL.trim()) {
    return globalThis.DESKHUB_DB_JSON_URL.trim();
  }
  if (typeof location !== 'undefined' && location.href) {
    if (location.pathname.includes('/public/')) {
      return new URL('../db.json', location.href).href;
    }
    return new URL('db.json', location.href).href;
  }
  return new URL('../../db.json', import.meta.url).href;
}

export async function loadLocalDb() {
  if (cache) {
    return cache;
  }
  if (!inflight) {
    const url = resolveDbJsonUrl();
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), FETCH_MS);

    inflight = fetch(url, { signal: controller.signal })
      .then(async (res) => {
        clearTimeout(timeoutId);
        if (!res.ok) {
          throw new Error(
            `Could not load db.json (${res.status}) from ${url}. Serve the repo root so db.json is reachable, or set window.DESKHUB_DB_JSON_URL.`,
          );
        }
        return res.json();
      })
      .then((data) => {
        cache = {
          users: Array.isArray(data.users) ? data.users : [],
          tickets: Array.isArray(data.tickets) ? data.tickets : [],
          comments: Array.isArray(data.comments) ? data.comments : [],
        };
        inflight = null;
        return cache;
      })
      .catch((err) => {
        clearTimeout(timeoutId);
        inflight = null;
        if (err && err.name === 'AbortError') {
          throw new Error(`Loading db.json timed out after ${FETCH_MS}ms (${url}).`);
        }
        throw err;
      });
  }
  return inflight;
}

/** Call after logout if you need a fresh read of db.json on next load (optional). */
export function resetLocalDbCache() {
  cache = null;
  inflight = null;
}
