/**
 * **Default:** real HTTP to `DESKHUB_API_BASE` (see `src/api/client.js`, default `http://localhost:3001`).
 * Run **`npm run api`** while using the UI so login, signup, tickets, and comments appear in the Network tab.
 *
 * **Offline / browser-only:** set `window.DESKHUB_USE_LOCAL_API = true` before `main.js` to use `db.json` +
 * `localStorage` only (no REST for auth/tickets except the initial `db.json` fetch).
 *
 * **Disable remote:** `window.DESKHUB_USE_REMOTE_API = false` (same effect as local API mode).
 */
export function useRemoteApi() {
  if (globalThis.DESKHUB_USE_LOCAL_API === true) return false;
  return globalThis.DESKHUB_USE_REMOTE_API !== false;
}
