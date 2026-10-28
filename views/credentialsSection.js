// Credentials section — list, add, edit, delete, copy-to-clipboard with auto-clear.
// All data lives inside the main encrypted DB blob, so it's zero-knowledge too.

import * as store from '../store.js';
import { h } from '../ui.js';

const revealed = new Set();       // credential ids whose password is currently visible
const editing = new Set();        // credential ids currently in edit mode
const AUTO_CLEAR_MS = 20000;

export function render() {
  const client = store.getClient(store.state.ui.clientId);
  if (!client) return '';
  const creds = client.credentials || [];

  return `
    <div class="cred-section">
      <div class="cred-bw">
        <div class="cred-bw-label">🔐 Bitwarden collection</div>
        <input class="cred-bw-input" placeholder="Collection name in Bitwarden (e.g. Sunrise-Dental)"
          value="${h(client.bitwardenCollection || '')}" data-action="save-bw">
        <div class="cred-bw-hint">Store the real passwords in Bitwarden. Reference the collection here — click to open the Bitwarden app.</div>
        ${client.bitwardenCollection
          ? `<button class="btn-ghost btn-sm" data-action="open-bw">Open Bitwarden</button>`
          : ''}
      </div>

      <div class="section-hdr" style="margin-top:20px">
        <div class="section-title">Credentials</div>
        <button class="btn-primary btn-sm" data-action="add-cred">+ Add credential</button>
      </div>

      ${creds.length === 0
        ? `<div class="empty-section">
            <div class="empty-ico">🔑</div>
            <div class="empty-t">No credentials yet</div>
            <div class="empty-s">Add logins you need quick access to. Encrypted with your master password — the server never sees them.</div>
            <button class="btn-primary" data-action="add-cred">Add first credential</button>
          </div>`
        : `<div class="cred-list">${creds.map(c => credRow(c)).join('')}</div>`}
    </div>
  `;
}

function credRow(c) {
  const isEditing = editing.has(c.id);
  const isRevealed = revealed.has(c.id);
  if (isEditing) {
    return `
      <div class="cred-item cred-edit" data-id="${c.id}">
        <div class="cred-edit-grid">
          <input class="cred-input" placeholder="Label" data-field="label" value="${h(c.label)}">
          <input class="cred-input" placeholder="URL" data-field="url" value="${h(c.url)}">
          <input class="cred-input" placeholder="Username" data-field="username" value="${h(c.username)}">
          <input class="cred-input" placeholder="Password" data-field="password" type="password" value="${h(c.password)}">
          <textarea class="cred-input cred-notes" placeholder="Notes" data-field="notes">${h(c.notes || '')}</textarea>
        </div>
        <div class="cred-edit-actions">
          <button class="btn-ghost btn-sm" data-action="cancel-edit" data-id="${c.id}">Cancel</button>
          <button class="btn-primary btn-sm" data-action="save-edit" data-id="${c.id}">Save</button>
        </div>
      </div>
    `;
  }
  return `
    <div class="cred-item" data-id="${c.id}">
      <div class="cred-head">
        <div class="cred-label">${h(c.label)}</div>
        <div class="cred-actions">
          <button class="cred-icon-btn" data-action="edit-cred" data-id="${c.id}" title="Edit">✎</button>
          <button class="cred-icon-btn danger" data-action="delete-cred" data-id="${c.id}" title="Delete">×</button>
        </div>
      </div>
      ${c.url ? `
        <div class="cred-row">
          <div class="cred-k">URL</div>
          <a class="cred-v cred-link" href="${h(c.url)}" target="_blank" rel="noopener noreferrer">${h(c.url)}</a>
          <button class="cred-copy" data-action="copy" data-value="${h(c.url)}" title="Copy">📋</button>
        </div>` : ''}
      ${c.username ? `
        <div class="cred-row">
          <div class="cred-k">User</div>
          <div class="cred-v cred-mono">${h(c.username)}</div>
          <button class="cred-copy" data-action="copy" data-value="${h(c.username)}" title="Copy">📋</button>
        </div>` : ''}
      ${c.password ? `
        <div class="cred-row">
          <div class="cred-k">Pass</div>
          <div class="cred-v cred-mono">${isRevealed ? h(c.password) : '••••••••••'}</div>
          <button class="cred-copy" data-action="reveal" data-id="${c.id}" title="${isRevealed ? 'Hide' : 'Show'}">${isRevealed ? '🙈' : '👁'}</button>
          <button class="cred-copy" data-action="copy-pass" data-id="${c.id}" title="Copy (clears in 20s)">📋</button>
        </div>` : ''}
      ${c.notes ? `<div class="cred-notes-view">${h(c.notes)}</div>` : ''}
    </div>
  `;
}

async function copyToClipboard(text, clearAfterMs) {
  try {
    await navigator.clipboard.writeText(text);
    toast('✓ Copied');
    if (clearAfterMs) {
      setTimeout(async () => {
        try {
          const current = await navigator.clipboard.readText();
          if (current === text) await navigator.clipboard.writeText('');
        } catch {}
      }, clearAfterMs);
    }
  } catch {
    toast('⚠ Clipboard blocked');
  }
}

function toast(msg) {
  const existing = document.getElementById('cred-toast');
  if (existing) existing.remove();
  const el = document.createElement('div');
  el.id = 'cred-toast';
  el.className = 'toast show';
  el.textContent = msg;
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 1600);
}

let bwTimer = null;

export function wireEvents(root) {
  root.addEventListener('click', (e) => {
    const el = e.target.closest('[data-action]');
    if (!el) return;
    const a = el.dataset.action;
    const clientId = store.state.ui.clientId;

    if (a === 'add-cred') {
      const id = store.addCredential(clientId, { label: 'New credential' });
      editing.add(id);
      store.uiMutate(() => {});
    } else if (a === 'edit-cred') {
      editing.add(el.dataset.id);
      store.uiMutate(() => {});
    } else if (a === 'cancel-edit') {
      editing.delete(el.dataset.id);
      store.uiMutate(() => {});
    } else if (a === 'save-edit') {
      const row = el.closest('.cred-item');
      const patch = {};
      row.querySelectorAll('[data-field]').forEach(inp => {
        patch[inp.dataset.field] = inp.value;
      });
      store.updateCredential(clientId, el.dataset.id, patch);
      editing.delete(el.dataset.id);
      store.uiMutate(() => {});
    } else if (a === 'delete-cred') {
      if (confirm('Delete this credential?')) {
        store.deleteCredential(clientId, el.dataset.id);
        editing.delete(el.dataset.id);
      }
    } else if (a === 'reveal') {
      if (revealed.has(el.dataset.id)) revealed.delete(el.dataset.id);
      else revealed.add(el.dataset.id);
      store.uiMutate(() => {});
    } else if (a === 'copy') {
      copyToClipboard(el.dataset.value, 0);
    } else if (a === 'copy-pass') {
      const client = store.getClient(clientId);
      const cr = client.credentials?.find(c => c.id === el.dataset.id);
      if (cr) copyToClipboard(cr.password, AUTO_CLEAR_MS);
    } else if (a === 'open-bw') {
      // Try opening Bitwarden's custom protocol; if nothing happens, user falls back to app.
      window.location.href = 'bitwarden://';
    }
  });

  root.addEventListener('input', (e) => {
    const el = e.target.closest('[data-action="save-bw"]');
    if (!el) return;
    const val = el.value;
    clearTimeout(bwTimer);
    bwTimer = setTimeout(() => {
      store.updateClient(store.state.ui.clientId, { bitwardenCollection: val });
    }, 500);
  });
}
