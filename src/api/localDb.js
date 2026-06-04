/**
 * Loads `db.json` from the static site (no separate API process).
 * Resolved URL is relative to this module: repo root `/db.json`.
 */

/** @type {{ users: unknown[]; tickets: unknown[]; comments: unknown[] } | null} */
let cache = null;

/** @type {Promise<{ users: unknown[]; tickets: unknown[]; comments: unknown[] }> | null} */
let inflight = null;

export async function loadLocalDb() {
  if (cache) {
    return cache;
  }
  if (!inflight) {
    const url = new URL('../../db.json', import.meta.url);
    inflight = fetch(url)
      .then(async (res) => {
        if (!res.ok) {
          throw new Error(`Could not load db.json (${res.status}). Is the file next to index.html on the server?`);
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
        inflight = null;
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
