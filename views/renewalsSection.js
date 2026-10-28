// Renewals — domain, hosting, SSL, plugin licences. Lives inside the Sites tab.

import * as store from '../store.js';
import { h } from '../ui.js';

const KIND_LABELS = { domain: '🌐 Domain', hosting: '🖥️ Hosting', ssl: '🔒 SSL', plugin: '🧩 Plugin', other: '📦 Other' };

export function render(clientId) {
  const client = store.getClient(clientId);
  if (!client) return '';
  const renewals = (client.renewals || []).slice().sort((a, b) => (a.expiresAt || '9999').localeCompare(b.expiresAt || '9999'));

  return `
    <div class="renewals-block">
      <div class="section-hdr">
        <div class="section-title">Renewals</div>
        <button class="btn-ghost btn-sm" data-action="add-renewal">+ Add renewal</button>
      </div>
      ${renewals.length === 0
        ? `<div class="renewals-empty">No renewals tracked. Add your client's domain &amp; hosting expiry dates so you get a heads-up before they lapse.</div>`
        : `<div class="renewal-list">${renewals.map(r => renewalRow(r)).join('')}</div>`}
    </div>
  `;
}

export function renewalRow(r, opts = {}) {
  const expires = r.expiresAt ? new Date(r.expiresAt).getTime() : null;
  const now = Date.now();
  const daysLeft = expires ? Math.round((expires - now) / 86400000) : null;
  const statusClass = daysLeft == null ? 'ren-unknown'
    : daysLeft < 0 ? 'ren-expired'
    : daysLeft <= 7 ? 'ren-urgent'
    : daysLeft <= 30 ? 'ren-soon'
    : 'ren-ok';
  const statusText = daysLeft == null ? 'no date'
    : daysLeft < 0 ? `expired ${-daysLeft}d ago`
    : daysLeft === 0 ? 'expires today'
    : daysLeft === 1 ? 'tomorrow'
    : `in ${daysLeft}d`;
  const dateLabel = r.expiresAt ? new Date(r.expiresAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }) : '—';
  return `
    <div class="renewal-row ${statusClass}">
      <div class="renewal-kind">${h(KIND_LABELS[r.kind] || r.kind)}</div>
      <div class="renewal-main">
        <div class="renewal-item">${h(r.item || '(unnamed)')}</div>
        <div class="renewal-sub">
          ${r.provider ? h(r.provider) : ''}
          ${r.cost ? `· ${h(r.cost)}` : ''}
          ${r.autoRenew ? '· <span class="ren-auto">auto-renew</span>' : ''}
          ${r.notes ? `· ${h(r.notes)}` : ''}
        </div>
      </div>
      <div class="renewal-date">
        <div class="renewal-when">${h(dateLabel)}</div>
        <div class="renewal-left">${h(statusText)}</div>
      </div>
      <div class="renewal-acts">
        ${r.url ? `<a class="file-btn" href="${h(r.url)}" target="_blank" rel="noopener noreferrer" title="Open management panel">↗</a>` : ''}
        <button class="file-btn" data-action="edit-renewal" data-id="${r.id}" title="Edit">✎</button>
        <button class="file-btn danger" data-action="delete-renewal" data-id="${r.id}" title="Delete">×</button>
      </div>
    </div>
  `;
}

export function wireEvents(root) {
  root.addEventListener('click', (e) => {
    const el = e.target.closest('[data-action]');
    if (!el) return;
    const a = el.dataset.action;
    const clientId = store.state.ui.clientId;
    if (a === 'add-renewal') {
      store.uiMutate(ui => { ui.modal = { kind: 'new-renewal', clientId }; });
    } else if (a === 'edit-renewal') {
      store.uiMutate(ui => { ui.modal = { kind: 'edit-renewal', clientId, renewalId: el.dataset.id }; });
    } else if (a === 'delete-renewal') {
      if (confirm('Delete this renewal reminder?')) store.deleteRenewal(clientId, el.dataset.id);
    }
  });
}
