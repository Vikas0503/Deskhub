import * as auth from '../api/auth.js';
import { ApiError } from '../api/client.js';
import { showPageLoader, hidePageLoader } from './ui.js';

function setError(el, message) {
  if (!el) return;
  el.textContent = message;
  el.hidden = !message;
}

export function initLoginPage() {
  const form = document.querySelector('form#login-form');
  const errorEl = document.getElementById('login-error');

  if (!form) return;

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    setError(errorEl, '');

    const email = /** @type {HTMLInputElement} */ (form.querySelector('#email'))?.value?.trim();
    const password = /** @type {HTMLInputElement} */ (form.querySelector('#password'))?.value ?? '';

    if (!email) {
      setError(errorEl, 'Enter your email.');
      return;
    }

    showPageLoader('Signing in…');
    try {
      await auth.login({ email, password });
      window.location.assign('./dashboard.html');
    } catch (err) {
      const message = err instanceof ApiError ? err.message : err instanceof Error ? err.message : 'Login failed.';
      setError(errorEl, message);
    } finally {
      hidePageLoader();
    }
  });
}
