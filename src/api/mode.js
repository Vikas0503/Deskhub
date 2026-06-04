/**
 * When `false` (default), auth/tickets/users use bundled `db.json` + in-browser demo login.
 * Set `window.DESKHUB_USE_REMOTE_API = true` to use `http://localhost:3001` (or `DESKHUB_API_BASE`) again.
 */
export function useRemoteApi() {
  return globalThis.DESKHUB_USE_REMOTE_API === true;
}
