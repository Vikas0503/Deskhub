const dateFormatter = new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' });
const dateTimeFormatter = new Intl.DateTimeFormat(undefined, {
  dateStyle: 'medium',
  timeStyle: 'short',
});

function toDate(value) {
  if (value == null || value === '') return null;
  const d = value instanceof Date ? value : new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

/** @param {string | number | Date | null | undefined} value */
export function formatDate(value) {
  const d = toDate(value);
  return d ? dateFormatter.format(d) : '—';
}

/** @param {string | number | Date | null | undefined} value */
export function formatDateTime(value) {
  const d = toDate(value);
  return d ? dateTimeFormatter.format(d) : '—';
}

/** @param {string | number | Date | null | undefined} value */
export function formatRelative(value) {
  const d = toDate(value);
  if (!d) return '—';

  const rtf = new Intl.RelativeTimeFormat(undefined, { numeric: 'auto' });
  const diffSec = Math.round((d.getTime() - Date.now()) / 1000);

  const abs = Math.abs(diffSec);
  if (abs < 60) return rtf.format(diffSec, 'second');

  const diffMin = Math.round(diffSec / 60);
  if (Math.abs(diffMin) < 60) return rtf.format(diffMin, 'minute');

  const diffHr = Math.round(diffMin / 60);
  if (Math.abs(diffHr) < 24) return rtf.format(diffHr, 'hour');

  const diffDay = Math.round(diffHr / 24);
  if (Math.abs(diffDay) < 7) return rtf.format(diffDay, 'day');

  const diffWeek = Math.round(diffDay / 7);
  if (Math.abs(diffWeek) < 5) return rtf.format(diffWeek, 'week');

  const diffMonth = Math.round(diffDay / 30);
  if (Math.abs(diffMonth) < 12) return rtf.format(diffMonth, 'month');

  const diffYear = Math.round(diffDay / 365);
  return rtf.format(diffYear, 'year');
}
