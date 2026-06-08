/**
 * Ticket detail page: shows one ticket, its comments, and lets you edit
 * status / priority / assignee plus an optional new comment. Nothing is sent
 * to the server until you click **Save changes**.
 */
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

/** @param {HTMLSelectElement} sel */
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
 * @param {string[]} allowed
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

/** @param {HTMLSelectElement} sel */
function resetPrioritySelectOptions(sel) {
  sel.replaceChildren();
  for (const v of PRIORITY_VALUES) {
    const opt = document.createElement('option');
    opt.value = v;
    opt.textContent = PRIORITY_LABELS[v] ?? v;
    sel.appendChild(opt);
  }
}

/** @param {HTMLSelectElement} sel */
function fillAssigneeDetailSelect(sel) {
  sel.replaceChildren();
  const unassigned = document.createElement('option');
  unassigned.value = '';
  unassigned.textContent = '— Unassigned —';
  sel.appendChild(unassigned);
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
  return displayName(getUserById(o.authorId));
}

/** Oldest first for a simple conversation thread. */
function compareCommentsOldestFirst(a, b) {
  const ta = a && typeof a === 'object' ? /** @type {{ createdAt?: unknown }} */ (a).createdAt : null;
  const tb = b && typeof b === 'object' ? /** @type {{ createdAt?: unknown }} */ (b).createdAt : null;
  if (typeof ta === 'string' && typeof tb === 'string') return ta.localeCompare(tb);
  const ia = a && typeof a === 'object' ? Number(/** @type {{ id?: unknown }} */ (a).id) : 0;
  const ib = b && typeof b === 'object' ? Number(/** @type {{ id?: unknown }} */ (b).id) : 0;
  return ia - ib;
}

/**
 * @param {unknown[]} list
 * @param {HTMLElement | null} container
 * @param {HTMLElement | null} emptyEl
 */
function renderComments(list, container, emptyEl) {
  if (!container) return;
  container.replaceChildren();
  const sorted = [...list].sort(compareCommentsOldestFirst);

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

/**
 * @param {{ status: string; priority: string; assigneeKey: string }} saved
 * @param {HTMLSelectElement} statusSelect
 * @param {HTMLSelectElement} prioritySelect
 * @param {HTMLSelectElement} assigneeSelect
 * @returns {Record<string, unknown>}
 */
function buildTicketPatch(saved, statusSelect, prioritySelect, assigneeSelect) {
  /** @type {Record<string, unknown>} */
  const patch = {};
  if (statusSelect.value !== saved.status) patch.status = statusSelect.value;
  if (prioritySelect.value !== saved.priority) patch.priority = prioritySelect.value;
  if (assigneeSelect.value !== saved.assigneeKey) {
    patch.assigneeId = assigneeSelect.value === '' ? null : Number(assigneeSelect.value);
  }
  return patch;
}

function currentUserAuthorId() {
  const me = auth.getCurrentUser();
  if (!me || typeof me !== 'object') return null;
  return /** @type {{ id?: unknown }} */ (me).id ?? null;
}

export function initTicketDetailPage() {
  if (!auth.isAuthenticated()) {
    window.location.replace('../index.html');
    return;
  }

  const params = new URLSearchParams(window.location.search);
  const idRaw = params.get('id');
  const ticketId = idRaw != null && idRaw !== '' ? idRaw : null;

  const errorEl = document.getElementById('detail-error');
  const commentBodyEl = /** @type {HTMLTextAreaElement | null} */ (document.getElementById('comment-body'));
  const commentsEl = document.getElementById('detail-comments');
  const commentsEmptyEl = document.getElementById('detail-comments-empty');
  const commentError = document.getElementById('comment-error');
  const statusSelect = /** @type {HTMLSelectElement | null} */ (document.getElementById('detail-status-select'));
  const statusError = document.getElementById('detail-status-error');
  const prioritySelect = /** @type {HTMLSelectElement | null} */ (document.getElementById('detail-priority-select'));
  const priorityError = document.getElementById('detail-priority-error');
  const assigneeSelect = /** @type {HTMLSelectElement | null} */ (document.getElementById('detail-assignee-select'));
  const assigneeError = document.getElementById('detail-assignee-error');
  const saveBtn = /** @type {HTMLButtonElement | null} */ (document.getElementById('detail-save-btn'));
  const saveError = document.getElementById('detail-save-error');
  const deleteBtn = document.getElementById('detail-delete-btn');

  /** Values last loaded from (or saved to) the server — used to detect unsaved edits. */
  /** @type {{ status: string; priority: string; assigneeKey: string } | null} */
  let lastSavedFields = null;

  /** True while we are filling the form from the server (ignore stray “change” events). */
  let loadingFromServer = false;

  function updateSaveButton() {
    if (!saveBtn || !statusSelect || !prioritySelect || !assigneeSelect || !lastSavedFields) {
      if (saveBtn) saveBtn.disabled = true;
      return;
    }
    const ticketChanged =
      statusSelect.value !== lastSavedFields.status ||
      prioritySelect.value !== lastSavedFields.priority ||
      assigneeSelect.value !== lastSavedFields.assigneeKey;
    const hasNewComment = (commentBodyEl?.value?.trim() ?? '') !== '';
    const hasSomethingToSave = ticketChanged || hasNewComment;
    saveBtn.disabled = !hasSomethingToSave || loadingFromServer;
  }

  if (!ticketId) {
    if (errorEl) {
      errorEl.hidden = false;
      errorEl.textContent = 'Missing ticket id.';
    }
    return;
  }

  /**
   * @param {Record<string, unknown>} ticket
   */
  function fillFormFromTicket(ticket) {
    if (statusSelect) {
      resetStatusSelectOptions(statusSelect);
      syncSelectToValue(statusSelect, STATUS_VALUES, typeof ticket.status === 'string' ? ticket.status : '');
    }
    if (prioritySelect) {
      resetPrioritySelectOptions(prioritySelect);
      syncSelectToValue(
        prioritySelect,
        PRIORITY_VALUES,
        typeof ticket.priority === 'string' ? ticket.priority : 'medium',
      );
    }
    if (assigneeSelect) {
      fillAssigneeDetailSelect(assigneeSelect);
      const aid = ticket.assigneeId;
      const key = aid != null && aid !== '' ? String(aid) : '';
      const optionExists = key && [...assigneeSelect.options].some((o) => o.value === key);
      assigneeSelect.value = optionExists ? key : '';
    }

    lastSavedFields = {
      status: statusSelect?.value ?? '',
      priority: prioritySelect?.value ?? '',
      assigneeKey: assigneeSelect?.value ?? '',
    };
    updateSaveButton();
  }

  async function loadTicketPage() {
    if (errorEl) {
      errorEl.hidden = true;
      errorEl.textContent = '';
    }
    hideError(statusError);
    hideError(priorityError);
    hideError(assigneeError);
    hideError(saveError);
    hideError(commentError);
    loadingFromServer = true;
    showPageLoader('Loading ticket…');
    try {
      await ensureUsersLoaded();
      const [ticket, comments] = await Promise.all([
        ticketsApi.getTicket(ticketId),
        ticketsApi.listComments(ticketId),
      ]);

      if (!ticket || typeof ticket !== 'object') throw new Error('Invalid ticket');
      const t = /** @type {Record<string, unknown>} */ (ticket);

      setText('detail-id', t.id != null ? `#${t.id}` : '—');
      setText('detail-title', typeof t.title === 'string' ? t.title : '—');
      setText('detail-customer', typeof t.customer === 'string' ? t.customer : '—');
      setText('detail-created', formatDateTime(t.createdAt ?? t.created ?? null));

      fillFormFromTicket(t);

      if (commentBodyEl) commentBodyEl.value = '';

      renderComments(Array.isArray(comments) ? comments : [], commentsEl, commentsEmptyEl);
    } catch (err) {
      lastSavedFields = null;
      if (errorEl) {
        errorEl.hidden = false;
        errorEl.textContent = err instanceof Error ? err.message : 'Could not load ticket.';
      }
    } finally {
      loadingFromServer = false;
      hidePageLoader();
      updateSaveButton();
    }
  }

  function onUserEdit() {
    if (loadingFromServer) return;
    updateSaveButton();
  }

  statusSelect?.addEventListener('change', onUserEdit);
  prioritySelect?.addEventListener('change', onUserEdit);
  assigneeSelect?.addEventListener('change', onUserEdit);
  commentBodyEl?.addEventListener('input', onUserEdit);

  saveBtn?.addEventListener('click', async () => {
    if (!saveBtn || !statusSelect || !prioritySelect || !assigneeSelect || !lastSavedFields) return;

    hideError(saveError);
    hideError(statusError);
    hideError(priorityError);
    hideError(assigneeError);
    hideError(commentError);

    const patch = buildTicketPatch(lastSavedFields, statusSelect, prioritySelect, assigneeSelect);
    const newCommentText = commentBodyEl?.value?.trim() ?? '';

    if (Object.keys(patch).length === 0 && !newCommentText) {
      return;
    }

    if (newCommentText && currentUserAuthorId() == null) {
      showError(commentError, 'Not signed in.');
      return;
    }

    saveBtn.disabled = true;
    try {
      if (Object.keys(patch).length > 0) {
        await ticketsApi.updateTicket(ticketId, patch);
      }
      if (newCommentText) {
        const authorId = currentUserAuthorId();
        await ticketsApi.addComment({
          ticketId: Number(ticketId) || ticketId,
          authorId,
          body: newCommentText,
        });
      }
      showToast('Saved', { variant: 'success' });
      await loadTicketPage();
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Save failed.';
      showError(saveError, msg);
      showToast(msg, { variant: 'error' });
      updateSaveButton();
    }
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
      await ticketsApi.deleteTicket(ticketId);
      showToast('Ticket deleted', { variant: 'success' });
      window.setTimeout(() => {
        window.location.assign('./tickets.html');
      }, 400);
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Could not delete ticket.', { variant: 'error' });
    }
  });

  void loadTicketPage();
}
