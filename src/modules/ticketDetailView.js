/**
 * Shared ticket detail UI: load ticket + comments, edit fields + comment, save, delete.
 * Used from the standalone detail page (`document`) or the tickets list modal (`modal` root).
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

/** Element ids on `public/ticket-detail.html` (standalone page). */
export const PAGE_DETAIL_IDS = /** @type {const} */ ({
  error: 'detail-error',
  commentBody: 'comment-body',
  comments: 'detail-comments',
  commentsEmpty: 'detail-comments-empty',
  commentError: 'comment-error',
  statusSelect: 'detail-status-select',
  statusError: 'detail-status-error',
  prioritySelect: 'detail-priority-select',
  priorityError: 'detail-priority-error',
  assigneeSelect: 'detail-assignee-select',
  assigneeError: 'detail-assignee-error',
  saveBtn: 'detail-save-btn',
  saveError: 'detail-save-error',
  deleteBtn: 'detail-delete-btn',
  detailId: 'detail-id',
  detailTitle: 'detail-title',
  detailCustomer: 'detail-customer',
  detailCreated: 'detail-created',
});

/** Element ids inside `#ticket-detail-modal` on `public/tickets.html`. */
export const MODAL_DETAIL_IDS = /** @type {const} */ ({
  error: 'tdm-detail-error',
  commentBody: 'tdm-comment-body',
  comments: 'tdm-detail-comments',
  commentsEmpty: 'tdm-detail-comments-empty',
  commentError: 'tdm-comment-error',
  statusSelect: 'tdm-detail-status-select',
  statusError: 'tdm-detail-status-error',
  prioritySelect: 'tdm-detail-priority-select',
  priorityError: 'tdm-detail-priority-error',
  assigneeSelect: 'tdm-detail-assignee-select',
  assigneeError: 'tdm-detail-assignee-error',
  saveBtn: 'tdm-detail-save-btn',
  saveError: 'tdm-detail-save-error',
  deleteBtn: 'tdm-detail-delete-btn',
  detailId: 'tdm-detail-id',
  detailTitle: 'tdm-detail-title',
  detailCustomer: 'tdm-detail-customer',
  detailCreated: 'tdm-detail-created',
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

/** @param {unknown} c */
function commentAuthorName(c) {
  if (!c || typeof c !== 'object') return '—';
  const o = /** @type {Record<string, unknown>} */ (c);
  return displayName(getUserById(o.authorId));
}

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

/**
 * @param {ParentNode} root
 * @param {typeof PAGE_DETAIL_IDS} ids
 */
function queryDetail(root, ids) {
  /** @param {keyof typeof PAGE_DETAIL_IDS} key */
  return (key) => root.querySelector(`#${/** @type {Record<string,string>} */ (ids)[key]}`);
}

/**
 * @param {typeof PAGE_DETAIL_IDS} ids
 * @param {ParentNode} root
 * @param {string | number} ticketId
 * @param {{ onDeleted?: () => void; deleteDelayMs?: number }} [options]
 */
export function initTicketDetailView(ids, root, ticketId, options = {}) {
  const { onDeleted, deleteDelayMs = 2000 } = options;
  let activeTicketId = ticketId;
  const $ = queryDetail(root, ids);

  const errorEl = /** @type {HTMLElement | null} */ ($('error'));
  const commentBodyEl = /** @type {HTMLTextAreaElement | null} */ ($('commentBody'));
  const commentsEl = /** @type {HTMLElement | null} */ ($('comments'));
  const commentsEmptyEl = /** @type {HTMLElement | null} */ ($('commentsEmpty'));
  const commentError = /** @type {HTMLElement | null} */ ($('commentError'));
  const statusSelect = /** @type {HTMLSelectElement | null} */ ($('statusSelect'));
  const statusError = /** @type {HTMLElement | null} */ ($('statusError'));
  const prioritySelect = /** @type {HTMLSelectElement | null} */ ($('prioritySelect'));
  const priorityError = /** @type {HTMLElement | null} */ ($('priorityError'));
  const assigneeSelect = /** @type {HTMLSelectElement | null} */ ($('assigneeSelect'));
  const assigneeError = /** @type {HTMLElement | null} */ ($('assigneeError'));
  const saveBtn = /** @type {HTMLButtonElement | null} */ ($('saveBtn'));
  const saveError = /** @type {HTMLElement | null} */ ($('saveError'));
  const deleteBtn = /** @type {HTMLButtonElement | null} */ ($('deleteBtn'));

  /** @type {{ status: string; priority: string; assigneeKey: string } | null} */
  let lastSavedFields = null;
  let loadingFromServer = false;

  function setDetailText(key, text) {
    const el = /** @type {HTMLElement | null} */ ($(key));
    if (el) el.textContent = text;
  }

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
    saveBtn.disabled = !(ticketChanged || hasNewComment) || loadingFromServer;
  }

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
        ticketsApi.getTicket(activeTicketId),
        ticketsApi.listComments(activeTicketId),
      ]);
      if (!ticket || typeof ticket !== 'object') throw new Error('Invalid ticket');
      const t = /** @type {Record<string, unknown>} */ (ticket);

      setDetailText('detailId', t.id != null ? `#${t.id}` : '—');
      setDetailText('detailTitle', typeof t.title === 'string' ? t.title : '—');
      setDetailText('detailCustomer', typeof t.customer === 'string' ? t.customer : '—');
      setDetailText('detailCreated', formatDateTime(t.createdAt ?? t.created ?? null));

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
    if (Object.keys(patch).length === 0 && !newCommentText) return;
    if (newCommentText && currentUserAuthorId() == null) {
      showError(commentError, 'Not signed in.');
      return;
    }

    saveBtn.disabled = true;
    showPageLoader('Saving…');
    try {
      if (Object.keys(patch).length > 0) {
        await ticketsApi.updateTicket(activeTicketId, patch);
      }
      if (newCommentText) {
        const authorId = currentUserAuthorId();
        await ticketsApi.addComment({
          ticketId: Number(activeTicketId) || activeTicketId,
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
    } finally {
      hidePageLoader();
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
    showPageLoader('Deleting ticket…');
    try {
      if (deleteDelayMs > 0) {
        await new Promise((resolve) => {
          window.setTimeout(resolve, deleteDelayMs);
        });
      }
      await ticketsApi.deleteTicket(activeTicketId);
      showToast('Ticket deleted', { variant: 'success' });
      if (onDeleted) {
        onDeleted();
      } else {
        window.location.assign('./tickets.html');
      }
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Could not delete ticket.', { variant: 'error' });
    } finally {
      hidePageLoader();
    }
  });

  void loadTicketPage();

  return {
    /**
     * @param {string | number} newId
     */
    reopen(newId) {
      activeTicketId = newId;
      return loadTicketPage();
    },
  };
}
