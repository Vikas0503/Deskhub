/** Toast queue, confirm dialog, full-screen loader (Day 31–32). */

const TOAST_DURATION_MS = 3000;
const MAX_VISIBLE_TOASTS = 5;
const CONFIRM_Z = 130;

let pageLoaderDepth = 0;

/** @returns {HTMLElement} */
function getToastHost() {
  let host = document.getElementById('dh-toast-host');
  if (!host) {
    host = document.createElement('div');
    host.id = 'dh-toast-host';
    host.className = 'dh-toast-host';
    host.setAttribute('aria-live', 'polite');
    document.body.appendChild(host);
  }
  return host;
}

/**
 * @param {string} message
 * @param {{ variant?: 'success' | 'error'; durationMs?: number }} [opts]
 */
export function showToast(message, opts = {}) {
  const { variant = 'success', durationMs = TOAST_DURATION_MS } = opts;
  const host = getToastHost();
  while (host.childElementCount >= MAX_VISIBLE_TOASTS) {
    host.firstElementChild?.remove();
  }

  const el = document.createElement('div');
  el.className = `dh-toast dh-toast--${variant}`;
  el.setAttribute('role', 'status');
  el.textContent = message;
  host.appendChild(el);

  requestAnimationFrame(() => {
    requestAnimationFrame(() => el.classList.add('dh-toast--visible'));
  });

  window.setTimeout(() => {
    el.classList.remove('dh-toast--visible');
    window.setTimeout(() => {
      el.remove();
      if (!host.childElementCount) host.remove();
    }, 220);
  }, durationMs);
}

/** @param {string} [message] */
export function showPageLoader(message = 'Loading…') {
  let root = document.getElementById('dh-page-loader');
  if (!root) {
    root = document.createElement('div');
    root.id = 'dh-page-loader';
    root.className = 'dh-page-loader';
    root.setAttribute('role', 'status');
    root.setAttribute('aria-live', 'polite');
    root.innerHTML =
      '<div class="dh-page-loader__backdrop"></div>' +
      '<div class="dh-page-loader__panel">' +
      '<div class="dh-page-loader__spinner" aria-hidden="true"></div>' +
      '<p class="dh-page-loader__text"></p>' +
      '</div>';
    document.body.appendChild(root);
  }
  const text = root.querySelector('.dh-page-loader__text');
  if (text) text.textContent = message;
  pageLoaderDepth += 1;
  root.hidden = false;
  requestAnimationFrame(() => {
    requestAnimationFrame(() => root.classList.add('dh-page-loader--visible'));
  });
}

export function hidePageLoader() {
  pageLoaderDepth = Math.max(0, pageLoaderDepth - 1);
  if (pageLoaderDepth > 0) return;
  const root = document.getElementById('dh-page-loader');
  if (!root) return;
  root.classList.remove('dh-page-loader--visible');
  window.setTimeout(() => {
    if (pageLoaderDepth === 0) root.hidden = true;
  }, 200);
}

/**
 * @param {{ title?: string; message: string; confirmLabel?: string; cancelLabel?: string }} opts
 * @returns {Promise<boolean>} true if confirmed
 */
export function confirmDialog(opts) {
  const {
    title = 'Confirm',
    message,
    confirmLabel = 'Yes',
    cancelLabel = 'Cancel',
  } = opts;

  return new Promise((resolve) => {
    const backdrop = document.createElement('div');
    backdrop.className = 'dh-confirm-backdrop';
    backdrop.style.zIndex = String(CONFIRM_Z);

    const panel = document.createElement('div');
    panel.className = 'dh-confirm-panel panel';
    panel.setAttribute('role', 'dialog');
    panel.setAttribute('aria-modal', 'true');
    panel.setAttribute('aria-labelledby', 'dh-confirm-title');

    const h = document.createElement('h2');
    h.id = 'dh-confirm-title';
    h.className = 'panel__title';
    h.textContent = title;

    const p = document.createElement('p');
    p.className = 'dh-confirm-message';
    p.textContent = message;

    const actions = document.createElement('div');
    actions.className = 'dh-confirm-actions';

    const cancel = document.createElement('button');
    cancel.type = 'button';
    cancel.className = 'btn btn--secondary';
    cancel.textContent = cancelLabel;

    const ok = document.createElement('button');
    ok.type = 'button';
    ok.className = 'btn btn--primary';
    ok.textContent = confirmLabel;

    let settled = false;
    function finish(value) {
      if (settled) return;
      settled = true;
      cleanup();
      resolve(value);
    }

    function onKey(ev) {
      if (ev.key === 'Escape') finish(false);
    }

    function cleanup() {
      document.removeEventListener('keydown', onKey, true);
      backdrop.classList.remove('dh-confirm-backdrop--visible');
      panel.classList.remove('dh-confirm-panel--visible');
      window.setTimeout(() => backdrop.remove(), 180);
    }

    cancel.addEventListener('click', () => finish(false));
    ok.addEventListener('click', () => finish(true));
    backdrop.addEventListener('click', (e) => {
      if (e.target === backdrop) finish(false);
    });

    actions.appendChild(cancel);
    actions.appendChild(ok);
    panel.appendChild(h);
    panel.appendChild(p);
    panel.appendChild(actions);
    backdrop.appendChild(panel);
    document.body.appendChild(backdrop);
    document.addEventListener('keydown', onKey, true);

    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        backdrop.classList.add('dh-confirm-backdrop--visible');
        panel.classList.add('dh-confirm-panel--visible');
      });
    });

    cancel.focus();
  });
}
