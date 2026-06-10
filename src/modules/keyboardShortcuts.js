/**
 * Global keyboard shortcuts (plain key, no Ctrl/Meta/Alt).
 * Skips when focus is in a field so typing is unaffected.
 */
import { showToast } from './ui.js';

/** @param {EventTarget | null} target */
function isEditableTarget(target) {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName;
  if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return true;
  if (target.isContentEditable) return true;
  return Boolean(target.closest('[contenteditable="true"]'));
}

/** @param {string} page */
function showShortcutsHelp(page) {
  let msg = '';
  if (page === 'tickets-list') {
    msg =
      'Shortcuts: / search · n new ticket · r reset filters · e export CSV · d dashboard · Esc close modal';
  } else if (page === 'dashboard') {
    msg = 'Shortcuts: t open tickets';
  } else if (page === 'login' || page === 'signup') {
    msg = 'Shortcuts: / focus first field · ? this help';
  } else {
    msg = 'Shortcuts: ? this help';
  }
  showToast(msg, { variant: 'success', durationMs: 5500 });
}

/**
 * Call once from `main.js` after DOM is available (same as other inits).
 */
export function initKeyboardShortcuts() {
  const page = document.body?.dataset?.page ?? '';

  document.addEventListener('keydown', (e) => {
    if (e.defaultPrevented) return;
    if (e.ctrlKey || e.metaKey || e.altKey) return;

    // ? (Shift+/ on US layouts) — help when not typing in a field
    if (e.key === '?' || (e.key === '/' && e.shiftKey)) {
      if (isEditableTarget(/** @type {EventTarget} */ (e.target))) return;
      e.preventDefault();
      showShortcutsHelp(page);
      return;
    }

    if (isEditableTarget(/** @type {EventTarget} */ (e.target))) return;

    if (page === 'tickets-list') {
      if (e.key === '/' && !e.shiftKey) {
        e.preventDefault();
        const search = document.getElementById('ticket-search');
        if (search instanceof HTMLInputElement) {
          search.focus();
          search.select();
        }
        return;
      }
      if (e.key === 'n' && !e.shiftKey) {
        e.preventDefault();
        document.getElementById('new-ticket-open')?.click();
        return;
      }
      if (e.key === 'r' && !e.shiftKey) {
        e.preventDefault();
        document.getElementById('tickets-reset-filters')?.click();
        return;
      }
      if (e.key === 'e' && !e.shiftKey) {
        e.preventDefault();
        document.getElementById('tickets-export-csv')?.click();
        return;
      }
      if (e.key === 'd' && !e.shiftKey) {
        e.preventDefault();
        window.location.assign('../dashboard.html');
        return;
      }
      return;
    }

    if (page === 'dashboard') {
      if (e.key === 't' && !e.shiftKey) {
        e.preventDefault();
        window.location.assign('./public/tickets.html');
        return;
      }
      return;
    }

    if (page === 'login' || page === 'signup') {
      if (e.key === '/' && !e.shiftKey) {
        e.preventDefault();
        const sel = page === 'login' ? '#login-form input' : '#signup-form input';
        const first = document.querySelector(sel);
        if (first instanceof HTMLElement) first.focus();
      }
    }
  });
}
