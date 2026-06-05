import * as storage from '../utils/storage.js';
import { clearUsersCache } from './users.js';
import { getMergedUsers, registerUser } from './localPersist.js';
import { useRemoteApi } from './mode.js';
import { get, post } from './client.js';

/** Default password for seed users in `db.json` who have no `password` field. */
const LOCAL_SEED_PASSWORD = 'password';

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

function stripPassword(user) {
  if (!user || typeof user !== 'object') return {};
  const u = /** @type {Record<string, unknown>} */ (user);
  return { id: u.id, name: u.name ?? '', email: u.email ?? '' };
}

/**
 * @param {{ name: string, email: string, password: string }} fields
 */
export async function signup({ name, email, password }) {
  if (useRemoteApi()) {
    throw new Error('Sign up is only set up for local (browser) mode in this demo.');
  }
  await registerUser({ name, email, password });
  clearUsersCache();
}

/**
 * @param {{ email: string, password: string }} credentials
 */
export async function login({ email, password }) {
  if (!useRemoteApi()) {
    const normalized = String(email).trim().toLowerCase();
    const merged = await getMergedUsers();
    const user = merged.find(
      (u) => u && typeof u === 'object' && String(/** @type {{ email?: unknown }} */ (u).email).toLowerCase() === normalized,
    );

    const u = /** @type {Record<string, unknown>} */ (user ?? {});
    const expected =
      typeof u.password === 'string' && u.password.length > 0 ? u.password : LOCAL_SEED_PASSWORD;

    if (!user || password !== expected) {
      throw new Error('Invalid email or password.');
    }

    const token = `demo-${u.id}`;
    storage.set('token', token);
    storage.set('user', JSON.stringify(stripPassword(user)));
    return { token, user: stripPassword(user) };
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
  storage.remove('token');
  storage.remove('user');
  clearUsersCache();
}
