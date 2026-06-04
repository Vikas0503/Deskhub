import * as auth from './api/auth.js';
import { ensureUsersLoaded } from './api/users.js';
import { initLoginPage } from './modules/auth.js';
import { initTicketsList } from './modules/tickets.js';

const page = document.body?.dataset?.page ?? '';

if (auth.isAuthenticated() && page && page !== 'login') {
  ensureUsersLoaded().catch(() => {
    /* tickets page shows its own error; dashboard ignores */
  });
}

if (page === 'login') {
  initLoginPage();
} else if (page === 'dashboard') {
  if (!auth.isAuthenticated()) {
    window.location.replace('./index.html');
  } else {
    const logoutBtn = document.getElementById('logout-btn');
    logoutBtn?.addEventListener('click', async () => {
      await auth.logout();
      window.location.replace('./index.html');
    });
  }
} else if (page === 'tickets-list') {
  initTicketsList();
}
