import * as auth from '../api/auth.js';
import * as ticketsApi from '../api/tickets.js';
import { ensureUsersLoaded, displayName, getUserById, listAssignableUsers } from '../api/users.js';
import { formatDateTime } from '../utils/formatDate.js';
import { showToast, confirmDialog, showPageLoader, hidePageLoader } from './ui.js';

const STATUS_VALUES = ['open', 'in progress', 'resolved', 'closed'];
const STATUS_LABELS = /** @type {Record<string, string>} */ ({
  open: 'Open',
  'in progress': 'In progress',
  resolved: 'Resolved',
  closed: 'Closed',
});

const PRIORITY_VALUES = ['low', 'medium', 'high', 'urgent'];
const PRIORITY_LABELS = /** @type {Record<string, string>} */ ({
  low: 'Low',
  medium: 'Medium',
  high: 'High',
  urgent: 'Urgent',
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
function syncSelectToValue(sel, allowed, current) {
  const c = typeof current === 'string' && current.trim() ? current.trim() : '';
  if (c && !allowed.includes(c)) {
    const opt = document.createElement('option');
    opt.value = c;
    opt.textContent = c;
    sel.appendChild(opt);
  }
  if (c && [...sel.options].some((o) => o.value === c)) {
    sel.value = c;
  } else {
    sel.value = allowed[0] ?? '';
  }
}

/**
 * @param {HTMLSelectElement} sel
 */
function resetPrioritySelectOptions(sel) {
  sel.replaceChildren();
  for (const v of PRIORITY_VALUES) {
    const opt = document.createElement('option');
    opt.value = v;
    opt.textContent = PRIORITY_LABELS[v] ?? v;
    sel.appendChild(opt);
  }
}

/**
 * @param {HTMLSelectElement} sel
 */
function fillAssigneeDetailSelect(sel) {
  sel.replaceChildren();
  const o0 = document.createElement('option');
  o0.value = '';
  o0.textContent = '— Unassigned —';
  sel.appendChild(o0);
  for (const u of listAssignableUsers()) {
    const opt = document.createElement('option');
    opt.value = String(u.id);
    opt.textContent = u.label;
    sel.appendChild(opt);
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

/**
 * @param {unknown[]} comments
 * @param {HTMLElement | null} container
 * @param {HTMLElement | null} emptyEl
 */
function renderComments(list, container, emptyEl) {
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

  if (emptyEl) {
    emptyEl.hidden = sorted.length > 0;
  }

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

/** @param {HTMLElement | null} el */
function hideError(el) {
  if (!el) return;
  el.hidden = true;
  el.textContent = '';
}

/** @param {HTMLElement | null} el @param {string} msg */
function showError(el, msg) {
  if (!el) return;
  el.textContent = msg;
  el.hidden = false;
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
  const commentsEmptyEl = document.getElementById('detail-comments-empty');
  const commentError = document.getElementById('comment-error');
  const statusSelect = /** @type {HTMLSelectElement | null} */ (document.getElementById('detail-status-select'));
  const statusError = document.getElementById('detail-status-error');
  const prioritySelect = /** @type {HTMLSelectElement | null} */ (document.getElementById('detail-priority-select'));
  const priorityError = document.getElementById('detail-priority-error');
  const assigneeSelect = /** @type {HTMLSelectElement | null} */ (document.getElementById('detail-assignee-select'));
  const assigneeError = document.getElementById('detail-assignee-error');
  const deleteBtn = document.getElementById('detail-delete-btn');

  if (!id) {
    if (errorEl) {
      errorEl.hidden = false;
      errorEl.textContent = 'Missing ticket id.';
    }
    return;
  }

  let applyingFromServer = false;

  async function load() {
    if (errorEl) {
      errorEl.hidden = true;
      errorEl.textContent = '';
    }
    hideError(statusError);
    hideError(priorityError);
    hideError(assigneeError);
    applyingFromServer = true;
    showPageLoader('Loading ticket…');
    try {
      await ensureUsersLoaded();
      const [ticket, comments] = await Promise.all([ticketsApi.getTicket(id), ticketsApi.listComments(id)]);

      if (!ticket || typeof ticket !== 'object') throw new Error('Invalid ticket');
      const t = /** @type {Record<string, unknown>} */ (ticket);

      setText('detail-id', t.id != null ? `#${t.id}` : '—');
      setText('detail-title', typeof t.title === 'string' ? t.title : '—');
      setText('detail-customer', typeof t.customer === 'string' ? t.customer : '—');
      setText('detail-created', formatDateTime(t.createdAt ?? t.created ?? null));

      if (statusSelect) {
        resetStatusSelectOptions(statusSelect);
        syncSelectToValue(statusSelect, STATUS_VALUES, typeof t.status === 'string' ? t.status : '');
      }
      if (prioritySelect) {
        resetPrioritySelectOptions(prioritySelect);
        syncSelectToValue(prioritySelect, PRIORITY_VALUES, typeof t.priority === 'string' ? t.priority : 'medium');
      }
      if (assigneeSelect) {
        fillAssigneeDetailSelect(assigneeSelect);
        const aid = t.assigneeId;
        const key = aid != null && aid !== '' ? String(aid) : '';
        const has = key && [...assigneeSelect.options].some((o) => o.value === key);
        assigneeSelect.value = has ? key : '';
      }

      renderComments(Array.isArray(comments) ? comments : [], commentsEl, commentsEmptyEl);
    } catch (err) {
      if (errorEl) {
        errorEl.hidden = false;
        errorEl.textContent = err instanceof Error ? err.message : 'Could not load ticket.';
      }
    } finally {
      applyingFromServer = false;
      hidePageLoader();
    }
  }

  async function patchField(patch, label, errorEl) {
    hideError(errorEl);
    try {
      await ticketsApi.updateTicket(id, patch);
      showToast(`${label} updated`, { variant: 'success' });
      await load();
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Update failed.';
      showError(errorEl, msg);
      showToast(msg, { variant: 'error' });
      await load();
    }
  }

  statusSelect?.addEventListener('change', () => {
    if (!statusSelect || applyingFromServer) return;
    void patchField({ status: statusSelect.value }, 'Status', statusError);
  });

  prioritySelect?.addEventListener('change', () => {
    if (!prioritySelect || applyingFromServer) return;
    void patchField({ priority: prioritySelect.value }, 'Priority', priorityError);
  });

  assigneeSelect?.addEventListener('change', () => {
    if (!assigneeSelect || applyingFromServer) return;
    const raw = assigneeSelect.value;
    const patch =
      raw === '' ? { assigneeId: null } : { assigneeId: Number(raw) };
    void patchField(patch, 'Assignee', assigneeError);
  });

  deleteBtn?.addEventListener('click', async () => {
    const ok = await confirmDialog({
      title: 'Delete ticket',
      message: 'Are you sure you want to delete this ticket? This cannot be undone.',
      confirmLabel: 'Delete',
      cancelLabel: 'Cancel',
    });
    if (!ok) return;
    try {
      await ticketsApi.deleteTicket(id);
      showToast('Ticket deleted', { variant: 'success' });
      window.setTimeout(() => {
        window.location.assign('./tickets.html');
      }, 400);
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Could not delete ticket.', { variant: 'error' });
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
      showToast('Comment added', { variant: 'success' });
      await load();
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to add comment.';
      if (commentError) {
        commentError.textContent = msg;
        commentError.hidden = false;
      }
      showToast(msg, { variant: 'error' });
    }
  });

  void load();
}
