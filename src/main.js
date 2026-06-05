import * as auth from './api/auth.js';
import { ensureUsersLoaded } from './api/users.js';
import { initLoginPage } from './modules/auth.js';
import { initSignupPage } from './modules/signup.js';
import { initTicketsList } from './modules/tickets.js';
import { initTicketDetailPage } from './modules/ticketDetail.js';
import { initDashboard } from './modules/dashboard.js';

const page = document.body?.dataset?.page ?? '';

if (auth.isAuthenticated() && page && page !== 'login' && page !== 'signup') {
  ensureUsersLoaded().catch(() => {
    /* tickets page shows its own error; dashboard ignores */
  });
}

if (page === 'login') {
  initLoginPage();
} else if (page === 'signup') {
  initSignupPage();
} else if (page === 'dashboard') {
  if (!auth.isAuthenticated()) {
    window.location.replace('./index.html');
  } else {
    initDashboard();
    const logoutBtn = document.getElementById('logout-btn');
    logoutBtn?.addEventListener('click', async () => {
      await auth.logout();
      window.location.replace('./index.html');
    });
  }
} else if (page === 'tickets-list') {
  initTicketsList();
} else if (page === 'ticket-detail') {
  initTicketDetailPage();
}
