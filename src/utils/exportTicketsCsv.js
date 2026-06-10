function escapeCsvCell(value) {
  const s = String(value ?? '');
  if (/[",\n\r]/.test(s)) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

/** UTF-8 CSV with BOM for Excel; triggers browser download. */
export function downloadTicketsAsCsv(tickets) {
  const header = ['id', 'title', 'customer', 'status', 'priority', 'assigneeId', 'createdAt', 'updatedAt'];
  const lines = [header.join(',')];

  for (const raw of tickets) {
    if (!raw || typeof raw !== 'object') continue;
    const t = /** @type {Record<string, unknown>} */ (raw);
    const row = [
      t.id,
      t.title,
      t.customer ?? t.customerName ?? '',
      t.status,
      t.priority,
      t.assigneeId ?? '',
      t.createdAt ?? t.created ?? '',
      t.updatedAt ?? '',
    ].map(escapeCsvCell);
    lines.push(row.join(','));
  }

  const csv = '\ufeff' + lines.join('\r\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `deskhub-tickets-${new Date().toISOString().slice(0, 10)}.csv`;
  a.rel = 'noopener';
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
