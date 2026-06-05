import * as auth from '../api/auth.js';
import * as ticketsApi from '../api/tickets.js';
import { ensureUsersLoaded, displayName, getUserById } from '../api/users.js';
import { formatDateTime } from '../utils/formatDate.js';

/** Values aligned with new-ticket form + `closed` (Day 30 style). */
const STATUS_VALUES = ['open', 'in progress', 'resolved', 'closed'];

const STATUS_LABELS = /** @type {Record<string, string>} */ ({
  open: 'Open',
  'in progress': 'In progress',
  resolved: 'Resolved',
  closed: 'Closed',
});

/**
 * @param {HTMLSelectElement} sel
 */
function resetStatusSelectOptions(sel) {
  sel.replaceChildren();
  for (const v of STATUS_VALUES) {
    const opt = document.createElement('option');
    opt.value = v;
    opt.textContent = STATUS_LABELS[v] ?? v;
    sel.appendChild(opt);
  }
}

/**
 * @param {HTMLSelectElement} sel
 * @param {string} current
 */
function syncStatusSelect(sel, current) {
  const c = typeof current === 'string' && current.trim() ? current.trim() : '';
  if (c && !STATUS_VALUES.includes(c)) {
    const opt = document.createElement('option');
    opt.value = c;
    opt.textContent = c;
    sel.appendChild(opt);
  }
  if (c && [...sel.options].some((o) => o.value === c)) {
    sel.value = c;
  } else {
    sel.value = STATUS_VALUES[0];
  }
}

function setText(id, text) {
  const el = document.getElementById(id);
  if (el) el.textContent = text;
}

/** @param {unknown} c */
function commentAuthorName(c) {
  if (!c || typeof c !== 'object') return '—';
  const o = /** @type {Record<string, unknown>} */ (c);
  const aid = o.authorId;
  return displayName(getUserById(aid));
}

/** @param {unknown[]} comments */
function renderComments(list, container) {
  if (!container) return;
  container.replaceChildren();
  const sorted = [...list].sort((a, b) => {
    const ta = a && typeof a === 'object' ? /** @type {{ createdAt?: unknown, id?: unknown }} */ (a).createdAt : null;
    const tb = b && typeof b === 'object' ? /** @type {{ createdAt?: unknown, id?: unknown }} */ (b).createdAt : null;
    if (typeof ta === 'string' && typeof tb === 'string') return ta.localeCompare(tb);
    const ia = a && typeof a === 'object' ? Number(/** @type {{ id?: unknown }} */ (a).id) : 0;
    const ib = b && typeof b === 'object' ? Number(/** @type {{ id?: unknown }} */ (b).id) : 0;
    return ia - ib;
  });

  for (const raw of sorted) {
    if (!raw || typeof raw !== 'object') continue;
    const c = /** @type {Record<string, unknown>} */ (raw);
    const article = document.createElement('article');
    article.className = 'comment-card';
    const meta = document.createElement('p');
    meta.className = 'comment-card__meta';
    const when = typeof c.createdAt === 'string' ? formatDateTime(c.createdAt) : '';
    meta.textContent = `${commentAuthorName(c)}${when ? ` · ${when}` : ''}`;
    const body = document.createElement('p');
    body.className = 'comment-card__body';
    body.textContent = typeof c.body === 'string' ? c.body : '';
    article.appendChild(meta);
    article.appendChild(body);
    container.appendChild(article);
  }
}

export function initTicketDetailPage() {
  if (!auth.isAuthenticated()) {
    window.location.replace('../index.html');
    return;
  }

  const params = new URLSearchParams(window.location.search);
  const idRaw = params.get('id');
  const id = idRaw != null && idRaw !== '' ? idRaw : null;

  const errorEl = document.getElementById('detail-error');
  const form = /** @type {HTMLFormElement | null} */ (document.querySelector('form#comment-form'));
  const commentsEl = document.getElementById('detail-comments');
  const commentError = document.getElementById('comment-error');
  const statusSelect = /** @type {HTMLSelectElement | null} */ (document.getElementById('detail-status-select'));
  const statusSaved = document.getElementById('detail-status-saved');
  const statusError = document.getElementById('detail-status-error');

  if (!id) {
    if (errorEl) {
      errorEl.hidden = false;
      errorEl.textContent = 'Missing ticket id.';
    }
    return;
  }

  async function load() {
    if (errorEl) {
      errorEl.hidden = true;
      errorEl.textContent = '';
    }
    try {
      await ensureUsersLoaded();
      const ticket = await ticketsApi.getTicket(id);
      if (!ticket || typeof ticket !== 'object') throw new Error('Invalid ticket');
      const t = /** @type {Record<string, unknown>} */ (ticket);

      setText('detail-id', t.id != null ? `#${t.id}` : '—');
      setText('detail-title', typeof t.title === 'string' ? t.title : '—');
      setText('detail-customer', typeof t.customer === 'string' ? t.customer : '—');
      setText('detail-priority', typeof t.priority === 'string' ? t.priority : '—');
      if (statusSelect) {
        resetStatusSelectOptions(statusSelect);
        syncStatusSelect(statusSelect, typeof t.status === 'string' ? t.status : '');
        if (statusError) {
          statusError.hidden = true;
          statusError.textContent = '';
        }
        if (statusSaved) statusSaved.hidden = true;
      }
      const assigneeId = t.assigneeId;
      setText('detail-assignee', displayName(getUserById(assigneeId)));
      setText('detail-created', formatDateTime(t.createdAt ?? t.created ?? null));

      const comments = await ticketsApi.listComments(id);
      renderComments(Array.isArray(comments) ? comments : [], commentsEl);
    } catch (err) {
      if (errorEl) {
        errorEl.hidden = false;
        errorEl.textContent = err instanceof Error ? err.message : 'Could not load ticket.';
      }
    }
  }

  statusSelect?.addEventListener('change', async () => {
    if (!statusSelect) return;
    if (statusError) {
      statusError.hidden = true;
      statusError.textContent = '';
    }
    if (statusSaved) statusSaved.hidden = true;
    try {
      await ticketsApi.updateTicket(id, { status: statusSelect.value });
      if (statusSaved) {
        statusSaved.hidden = false;
        window.setTimeout(() => {
          if (statusSaved) statusSaved.hidden = true;
        }, 1600);
      }
    } catch (err) {
      if (statusError) {
        statusError.textContent = err instanceof Error ? err.message : 'Could not update status.';
        statusError.hidden = false;
      }
      await load();
    }
  });

  form?.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (commentError) {
      commentError.textContent = '';
      commentError.hidden = true;
    }
    const ta = /** @type {HTMLTextAreaElement | null} */ (form.querySelector('#comment-body'));
    const body = ta?.value?.trim() ?? '';
    if (!body) {
      if (commentError) {
        commentError.textContent = 'Write a comment first.';
        commentError.hidden = false;
      }
      return;
    }
    const me = auth.getCurrentUser();
    const authorId = me && typeof me === 'object' ? /** @type {{ id?: unknown }} */ (me).id : null;
    if (authorId == null) {
      if (commentError) {
        commentError.textContent = 'Not signed in.';
        commentError.hidden = false;
      }
      return;
    }
    try {
      await ticketsApi.addComment({
        ticketId: Number(id) || id,
        authorId,
        body,
      });
      ta.value = '';
      await load();
    } catch (err) {
      if (commentError) {
        commentError.textContent = err instanceof Error ? err.message : 'Failed to add comment.';
        commentError.hidden = false;
      }
    }
  });

  void load();
}
