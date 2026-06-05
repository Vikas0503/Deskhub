/**
 * Client-side "DB" for static hosting: merges seed `db.json` with localStorage overlays.
 * Passwords for self-registered users are stored in plain text for local demo only.
 */
import * as storage from '../utils/storage.js';
import { loadLocalDb } from './localDb.js';

const KEY_REGISTERED = 'registeredUsers';
const KEY_TICKETS = 'ticketsSnapshot';
const KEY_COMMENTS = 'commentsSnapshot';

function cloneJson(x) {
  return JSON.parse(JSON.stringify(x));
}

export function getRegisteredUsers() {
  try {
    const raw = storage.get(KEY_REGISTERED);
    if (!raw) return [];
    const p = JSON.parse(raw);
    return Array.isArray(p) ? p : [];
  } catch {
    return [];
  }
}

function setRegisteredUsers(arr) {
  storage.set(KEY_REGISTERED, JSON.stringify(arr));
}

/** Merges seed `users` with self-registered accounts (by email). */
export async function getMergedUsers() {
  const db = await loadLocalDb();
  const map = new Map();
  for (const u of db.users) {
    if (u && typeof u === 'object' && u.email != null) {
      map.set(String(u.email).toLowerCase(), cloneJson(u));
    }
  }
  for (const u of getRegisteredUsers()) {
    if (u && typeof u === 'object' && u.email != null) {
      const k = String(u.email).toLowerCase();
      if (!map.has(k)) map.set(k, cloneJson(u));
    }
  }
  return Array.from(map.values());
}

/**
 * @param {{ name: string, email: string, password: string }} fields
 */
export async function registerUser({ name, email, password }) {
  const norm = email.trim().toLowerCase();
  const merged = await getMergedUsers();
  if (merged.some((u) => String(/** @type {{ email?: unknown }} */ (u).email).toLowerCase() === norm)) {
    throw new Error('An account with this email already exists.');
  }
  const db = await loadLocalDb();
  const reg = getRegisteredUsers();
  const allIds = [
    ...db.users.map((u) => Number(/** @type {{ id?: unknown }} */ (u).id)),
    ...reg.map((u) => Number(/** @type {{ id?: unknown }} */ (u).id)),
  ].filter((n) => Number.isFinite(n));
  const nextId = (allIds.length ? Math.max(...allIds) : 0) + 1;
  const user = {
    id: nextId,
    name: name.trim(),
    email: email.trim(),
    password,
  };
  reg.push(user);
  setRegisteredUsers(reg);
  return { id: user.id, name: user.name, email: user.email };
}

export async function getTickets() {
  const raw = storage.get(KEY_TICKETS);
  if (raw) {
    try {
      const p = JSON.parse(raw);
      return Array.isArray(p) ? p.map(cloneJson) : [];
    } catch {
      /* fall through */
    }
  }
  const db = await loadLocalDb();
  return db.tickets.map((t) => cloneJson(t));
}

export function persistTickets(tickets) {
  storage.set(KEY_TICKETS, JSON.stringify(tickets));
}

export async function getComments() {
  const raw = storage.get(KEY_COMMENTS);
  if (raw) {
    try {
      const p = JSON.parse(raw);
      return Array.isArray(p) ? p.map(cloneJson) : [];
    } catch {
      /* fall through */
    }
  }
  const db = await loadLocalDb();
  return db.comments.map((c) => cloneJson(c));
}

export function persistComments(comments) {
  storage.set(KEY_COMMENTS, JSON.stringify(comments));
}
