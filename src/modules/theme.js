/** Persisted UI theme: `light` or `dark`. */
const STORAGE_KEY = 'deskhub-theme';

const ICON_SUN =
  '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41"/></svg>';

const ICON_MOON =
  '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z"/></svg>';

/** @param {'light' | 'dark'} mode */
export function applyTheme(mode) {
  document.documentElement.dataset.theme = mode;
}

/** @returns {'light' | 'dark'} */
function readStoredTheme() {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (raw === 'light' || raw === 'dark') return raw;
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

/** @param {'light' | 'dark'} mode */
function persistTheme(mode) {
  localStorage.setItem(STORAGE_KEY, mode);
}

/**
 * Applies saved (or system) theme and adds a toggle to the header when possible.
 * Call once from `main.js` on every page.
 */
export function initTheme() {
  const initial = readStoredTheme();
  applyTheme(initial);

  if (document.getElementById('deskhub-theme-toggle')) return;

  const btn = document.createElement('button');
  btn.id = 'deskhub-theme-toggle';
  btn.type = 'button';
  btn.className = 'btn btn--secondary theme-toggle';
  btn.setAttribute('aria-pressed', initial === 'dark' ? 'true' : 'false');

  /** @param {'light' | 'dark'} mode */
  function applyIconAndLabel(mode) {
    const isDark = mode === 'dark';
    btn.innerHTML = isDark ? ICON_SUN : ICON_MOON;
    btn.setAttribute('aria-label', isDark ? 'Switch to light theme' : 'Switch to dark theme');
    btn.title = isDark ? 'Light theme' : 'Dark theme';
  }

  applyIconAndLabel(initial);

  btn.addEventListener('click', () => {
    const current = document.documentElement.dataset.theme === 'light' ? 'light' : 'dark';
    const next = current === 'dark' ? 'light' : 'dark';
    applyTheme(next);
    persistTheme(next);
    applyIconAndLabel(next);
    btn.setAttribute('aria-pressed', next === 'dark' ? 'true' : 'false');
  });

  const nav = document.querySelector('.app-bar__nav, .app-bar__nav-end');
  const bar = document.querySelector('.app-bar');
  if (nav) {
    nav.appendChild(btn);
  } else if (bar) {
    btn.classList.add('theme-toggle--floating');
    document.body.appendChild(btn);
  } else {
    btn.classList.add('theme-toggle--floating');
    document.body.appendChild(btn);
  }
}
