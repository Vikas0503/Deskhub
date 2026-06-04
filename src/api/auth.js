import * as storage from '../utils/storage.js';
import { clearUsersCache } from './users.js';
import { loadLocalDb } from './localDb.js';
import { useRemoteApi } from './mode.js';
import { get, post } from './client.js';

/** Same demo password as `server.cjs` (local JSON mode). */
const LOCAL_DEMO_PASSWORD = 'password';

/** Optional overrides: `window.DESKHUB_LOGIN_PATH`, etc. */
const LOGIN_PATH = globalThis.DESKHUB_LOGIN_PATH ?? '/auth/login';
const ME_PATH = globalThis.DESKHUB_ME_PATH ?? '/auth/me';
const LOGOUT_PATH = globalThis.DESKHUB_LOGOUT_PATH ?? '/auth/logout';

function readToken() {
  return storage.get('token');
}

function authHeaders() {
  const token = readToken();
  if (!token) return {};
  return { Authorization: `Bearer ${token}` };
}

function pickToken(data) {
  if (!data || typeof data !== 'object') return null;
  return (
    data.token ??
    data.accessToken ??
    data.access_token ??
    (data.data && typeof data.data === 'object' ? data.data.token : null) ??
    null
  );
}

function pickUser(data) {
  if (!data || typeof data !== 'object') return null;
  if (data.user) return data.user;
  const nested = data.data;
  if (nested && typeof nested === 'object' && nested.user) return nested.user;
  return null;
}

/**
 * @param {{ email: string, password: string }} credentials
 */
export async function login({ email, password }) {
  if (!useRemoteApi()) {
    const db = await loadLocalDb();
    const normalized = String(email).trim().toLowerCase();
    const user = db.users.find(
      (u) => u && typeof u === 'object' && String(/** @type {{ email?: unknown }} */ (u).email).toLowerCase() === normalized,
    );

    if (!user || password !== LOCAL_DEMO_PASSWORD) {
      throw new Error('Invalid email or password');
    }

    const u = /** @type {{ id: unknown; name?: unknown; email?: unknown }} */ (user);
    const token = `demo-${u.id}`;
    const safeUser = { id: u.id, name: u.name ?? '', email: u.email ?? '' };

    storage.set('token', token);
    storage.set('user', JSON.stringify(safeUser));
    return { token, user: safeUser };
  }

  const data = await post(LOGIN_PATH, { email, password });
  const token = pickToken(data);

  if (!token || typeof token !== 'string') {
    throw new Error('Login response did not include a token');
  }

  storage.set('token', token);

  const inlineUser = pickUser(data);
  if (inlineUser) {
    storage.set('user', JSON.stringify(inlineUser));
  } else {
    const me = await get(ME_PATH, { headers: authHeaders() });
    const user = pickUser(me) ?? me;
    storage.set('user', JSON.stringify(user ?? {}));
  }

  return data;
}

export function getCurrentUser() {
  const raw = storage.get('user');
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export function isAuthenticated() {
  return Boolean(readToken());
}

export async function logout() {
  if (useRemoteApi()) {
    try {
      await post(LOGOUT_PATH, {}, { headers: authHeaders() });
    } catch {
      // still clear local session
    }
  }
  storage.clear();
  clearUsersCache();
}
