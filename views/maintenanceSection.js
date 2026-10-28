// Maintenance section — log entries + PDF-ready report export.

import * as store from '../store.js';
import { h, formatDate } from '../ui.js';

export function render() {
  const client = store.getClient(store.state.ui.clientId);
  if (!client) return '';
  const entries = (client.maintenanceEntries || []).slice().sort((a, b) => (b.date || '').localeCompare(a.date || ''));
  const unsent = entries.filter(e => !e.sent).length;

  return `
    <div class="maint-section">
      <div class="maint-head">
        <div>
          <div class="maint-h">🛠 Maintenance log</div>
          <div class="maint-sub">${entries.length} ${entries.length === 1 ? 'entry' : 'entries'}${unsent > 0 ? ` · <strong>${unsent} not yet reported</strong>` : ''}</div>
        </div>
        <div class="maint-acts">
          <button class="btn-ghost btn-sm" data-action="export-report">⇩ Export report</button>
          <button class="btn-primary btn-sm" data-action="add-entry">+ Add entry</button>
        </div>
      </div>

      ${entries.length === 0
        ? `<div class="empty-section">
            <div class="empty-ico">🛠</div>
            <div class="empty-t">No maintenance work logged</div>
            <div class="empty-s">Log every maintenance task — updates, backups, security scans — then export the client-ready report when it's time to send.</div>
            <button class="btn-primary" data-action="add-entry">Log first entry</button>
          </div>`
        : `<div class="maint-list">${entries.map(e => entryRow(e)).join('')}</div>`}
    </div>
  `;
}

function entryRow(e) {
  return `
    <div class="maint-row ${e.sent ? 'sent' : ''}">
      <div class="maint-date">
        <div class="maint-date-d">${formatShortDate(e.date)}</div>
        ${e.sent
          ? `<span class="maint-sent-pill">✓ sent</span>`
          : `<button class="maint-mark" data-action="mark-sent" data-id="${e.id}" title="Mark as reported">mark sent</button>`}
      </div>
      <div class="maint-main">
        <div class="maint-task">${h(e.task)}</div>
        ${e.notes ? `<div class="maint-notes">${h(e.notes)}</div>` : ''}
        ${e.hoursSpent ? `<div class="maint-hours">${h(e.hoursSpent)} h</div>` : ''}
      </div>
      <div class="maint-row-acts">
        <button class="file-btn" data-action="edit-entry" data-id="${e.id}" title="Edit">✎</button>
        <button class="file-btn danger" data-action="delete-entry" data-id="${e.id}" title="Delete">×</button>
      </div>
    </div>
  `;
}

function formatShortDate(iso) {
  if (!iso) return '—';
  try {
    const d = new Date(iso);
    return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
  } catch { return iso; }
}

// ─── report generation (opens a print window; user saves as PDF) ──────
function buildReport(client, entries, range) {
  const biz = store.state.db.settings.business || {};
  const today = new Date().toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' });
  const rangeLabel = range && (range.from || range.to)
    ? `${range.from ? formatShortDate(range.from) : 'start'} – ${range.to ? formatShortDate(range.to) : 'now'}`
    : 'All time';
  const sorted = entries.slice().sort((a, b) => (a.date || '').localeCompare(b.date || ''));
  const total = sorted.reduce((a, e) => a + (parseFloat(e.hoursSpent) || 0), 0);

  const rows = sorted.map(e => `
    <tr>
      <td class="r-date">${formatShortDate(e.date)}</td>
      <td class="r-task">
        <div class="r-task-main">${escapeHtml(e.task)}</div>
        ${e.notes ? `<div class="r-task-notes">${escapeHtml(e.notes)}</div>` : ''}
      </td>
      <td class="r-hrs">${e.hoursSpent ? escapeHtml(e.hoursSpent) + ' h' : '—'}</td>
    </tr>
  `).join('');

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<title>Maintenance report — ${escapeHtml(client.name)}</title>
<style>
  @page { size: A4; margin: 20mm 18mm 24mm; }
  * { box-sizing: border-box; }
  body { font-family: 'Segoe UI', 'Helvetica Neue', Arial, sans-serif; color: #1a1814; margin: 0; padding: 32px 36px; font-size: 13px; line-height: 1.55; background: #fff; }
  .hdr { border-bottom: 2px solid #1a1814; padding-bottom: 16px; margin-bottom: 24px; display: flex; justify-content: space-between; align-items: flex-end; }
  .hdr-l h1 { font-family: Georgia, 'Playfair Display', serif; font-size: 26px; margin: 0 0 4px; letter-spacing: -0.02em; }
  .hdr-l .meta { color: #6b6760; font-size: 11px; }
  .hdr-r { text-align: right; font-size: 11px; color: #6b6760; }
  .hdr-r .doc { font-weight: 700; color: #1a1814; font-size: 12px; letter-spacing: 0.1em; text-transform: uppercase; margin-bottom: 4px; }
  .intro { margin-bottom: 20px; color: #3d3a34; font-size: 13px; }
  .intro strong { color: #1a1814; }
  table { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
  thead th { text-align: left; border-bottom: 1.5px solid #1a1814; padding: 10px 8px; font-size: 10px; text-transform: uppercase; letter-spacing: 0.08em; color: #6b6760; }
  tbody td { padding: 10px 8px; border-bottom: 1px solid #e4e2da; vertical-align: top; }
  tbody tr:last-child td { border-bottom: none; }
  .r-date { white-space: nowrap; font-weight: 500; width: 110px; }
  .r-hrs { white-space: nowrap; text-align: right; font-variant-numeric: tabular-nums; width: 70px; }
  .r-task-main { font-weight: 500; }
  .r-task-notes { color: #6b6760; font-size: 12px; margin-top: 3px; }
  .totals { text-align: right; font-size: 13px; padding: 10px 8px 0; border-top: 1.5px solid #1a1814; margin-top: -1px; }
  .totals strong { font-size: 15px; margin-left: 10px; }
  .ftr { position: fixed; bottom: 20mm; left: 18mm; right: 18mm; border-top: 1px solid #c7c3bb; padding-top: 10px; font-size: 10px; color: #6b6760; display: flex; justify-content: space-between; }
  .ftr-l { font-weight: 600; color: #1a1814; }
  .no-print { position: fixed; top: 12px; right: 12px; background: #1a1814; color: #fff; border: none; padding: 10px 16px; border-radius: 8px; font-size: 13px; cursor: pointer; font-family: inherit; z-index: 999; }
  @media print { .no-print { display: none; } }
  .empty-note { text-align: center; color: #9b9790; padding: 30px; font-style: italic; }
</style>
</head>
<body>
<button class="no-print" onclick="window.print()">⇩ Save as PDF</button>

<div class="hdr">
  <div class="hdr-l">
    <h1>${escapeHtml(client.name)}</h1>
    <div class="meta">${client.niche ? escapeHtml(client.niche) + ' · ' : ''}${client.contactName ? escapeHtml(client.contactName) : ''}</div>
  </div>
  <div class="hdr-r">
    <div class="doc">Maintenance report</div>
    <div>${rangeLabel}</div>
    <div>Issued ${today}</div>
  </div>
</div>

<div class="intro">
  Hi ${escapeHtml(client.contactName || 'there')}, here's a summary of the maintenance work completed on <strong>${escapeHtml(client.name)}</strong> for the period <strong>${rangeLabel.toLowerCase()}</strong>.
</div>

${sorted.length === 0 ? `<div class="empty-note">No maintenance entries in this range.</div>` : `
<table>
  <thead>
    <tr>
      <th class="r-date">Date</th>
      <th>Task</th>
      <th class="r-hrs">Hours</th>
    </tr>
  </thead>
  <tbody>${rows}</tbody>
</table>
${total > 0 ? `<div class="totals">Total hours <strong>${total.toFixed(1)} h</strong></div>` : ''}
`}

<div class="ftr">
  <div>
    ${biz.name ? `<div class="ftr-l">${escapeHtml(biz.name)}</div>` : ''}
    ${[biz.email, biz.phone, biz.website].filter(Boolean).map(escapeHtml).join('  ·  ') || '<em>Set your business details in Settings</em>'}
  </div>
  <div>Report generated via WP Studio</div>
</div>

<script>
  // Give the layout a tick, then open the native print dialog.
  setTimeout(() => { window.print(); }, 250);
</script>
</body>
</html>`;
}

function escapeHtml(s) {
  return String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

function openReport(client, entries, range) {
  const html = buildReport(client, entries, range);
  const w = window.open('', '_blank');
  if (!w) {
    alert('Pop-up blocked. Please allow pop-ups for this site so the report can open.');
    return;
  }
  w.document.open();
  w.document.write(html);
  w.document.close();
}

export function wireEvents(root) {
  root.addEventListener('click', (e) => {
    const el = e.target.closest('[data-action]');
    if (!el) return;
    const a = el.dataset.action;
    const clientId = store.state.ui.clientId;

    if (a === 'add-entry') {
      store.uiMutate(ui => { ui.modal = { kind: 'add-maint-entry', clientId }; });
    } else if (a === 'edit-entry') {
      store.uiMutate(ui => { ui.modal = { kind: 'edit-maint-entry', clientId, entryId: el.dataset.id }; });
    } else if (a === 'delete-entry') {
      if (confirm('Delete this maintenance entry?')) store.deleteMaintenanceEntry(clientId, el.dataset.id);
    } else if (a === 'mark-sent') {
      store.updateMaintenanceEntry(clientId, el.dataset.id, { sent: true });
    } else if (a === 'export-report') {
      // Default range: all entries. Prompt for optional filter.
      const client = store.getClient(clientId);
      const unsent = (client.maintenanceEntries || []).filter(e => !e.sent);
      let entries = client.maintenanceEntries || [];
      let range = null;
      if (unsent.length > 0 && unsent.length < entries.length) {
        const choice = confirm(`Include only the ${unsent.length} unsent entries? (Cancel for all ${entries.length} entries)`);
        if (choice) entries = unsent;
      }
      openReport(client, entries, range);
    }
  });
}
