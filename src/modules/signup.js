import * as auth from '../api/auth.js';
import { ApiError } from '../api/client.js';

function setError(el, message) {
  if (!el) return;
  el.textContent = message;
  el.hidden = !message;
}

export function initSignupPage() {
  const form = document.querySelector('form#signup-form');
  const errorEl = document.getElementById('signup-error');

  if (!form) return;

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    setError(errorEl, '');

    const name = /** @type {HTMLInputElement} */ (form.querySelector('#name'))?.value?.trim() ?? '';
    const email = /** @type {HTMLInputElement} */ (form.querySelector('#email'))?.value?.trim() ?? '';
    const password = /** @type {HTMLInputElement} */ (form.querySelector('#password'))?.value ?? '';
    const confirm = /** @type {HTMLInputElement} */ (form.querySelector('#confirm-password'))?.value ?? '';

    if (!name) {
      setError(errorEl, 'Enter your name.');
      return;
    }
    if (!email) {
      setError(errorEl, 'Enter your email.');
      return;
    }
    if (password.length < 6) {
      setError(errorEl, 'Password must be at least 6 characters.');
      return;
    }
    if (password !== confirm) {
      setError(errorEl, 'Passwords do not match.');
      return;
    }

    try {
      await auth.signup({ name, email, password });
      window.location.assign('./index.html?registered=1');
    } catch (err) {
      const message =
        err instanceof ApiError ? err.message : err instanceof Error ? err.message : 'Sign up failed.';
      setError(errorEl, message);
    }
  });
}
