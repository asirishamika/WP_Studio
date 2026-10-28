// Vault section — upload / list / preview / download / delete encrypted files.
// Each file is a separate ciphertext blob keyed by UUID; metadata lives in the main DB.

import * as store from '../store.js';
import * as api from '../api.js';
import * as cryptoLib from '../crypto.js';
import { h, formatDate } from '../ui.js';

const MAX_FILE_BYTES = 9 * 1024 * 1024; // 9 MB client-side cap (server allows 10)
const uploads = new Map(); // name -> {progress, state: 'upload'|'done'|'error', msg}

export function render() {
  const client = store.getClient(store.state.ui.clientId);
  if (!client) return '';
  const files = (client.files || []).slice().sort((a, b) => b.uploadedAt - a.uploadedAt);

  return `
    <div class="vault-section">
      <div class="vault-drop" data-action="click-upload">
        <div class="vault-drop-ico">⤒</div>
        <div class="vault-drop-main">Drop files here or <span class="vault-drop-link">browse</span></div>
        <div class="vault-drop-hint">All files encrypted in your browser before upload · max 9 MB each</div>
        <input id="vault-file-input" type="file" multiple hidden>
      </div>

      ${uploads.size > 0 ? `
        <div class="vault-upload-list">
          ${[...uploads.entries()].map(([name, u]) => `
            <div class="vault-upload-row ${u.state}">
              <div class="vault-upload-name">${h(name)}</div>
              <div class="vault-upload-state">${h(u.msg || u.state)}</div>
            </div>
          `).join('')}
        </div>
      ` : ''}

      <div class="section-hdr" style="margin-top:20px">
        <div class="section-title">Files (${files.length})</div>
      </div>

      ${files.length === 0
        ? `<div class="empty-section">
            <div class="empty-ico">📁</div>
            <div class="empty-t">No files yet</div>
            <div class="empty-s">Upload briefs, mockups, credentials docs, tutorials — anything you want in one place. All encrypted.</div>
          </div>`
        : `<div class="file-list">${files.map(f => fileRow(f)).join('')}</div>`}
    </div>
  `;
}

function fileRow(f) {
  const sizeLabel = f.size < 1024 ? `${f.size} B`
    : f.size < 1024*1024 ? `${(f.size/1024).toFixed(1)} KB`
    : `${(f.size/(1024*1024)).toFixed(1)} MB`;
  return `
    <div class="file-row">
      <div class="file-ico">${iconFor(f)}</div>
      <div class="file-meta">
        <div class="file-name">${h(f.name)}</div>
        <div class="file-sub">${h(sizeLabel)} · ${h(formatDate(f.uploadedAt))}${f.tag ? ` · <span class="file-tag">${h(f.tag)}</span>` : ''}</div>
      </div>
      <div class="file-acts">
        <button class="file-btn" data-action="download" data-id="${f.id}" title="Download">⤓</button>
        <button class="file-btn" data-action="rename" data-id="${f.id}" title="Rename">✎</button>
        <button class="file-btn danger" data-action="delete-file" data-id="${f.id}" title="Delete">×</button>
      </div>
    </div>
  `;
}

function iconFor(f) {
  const t = f.type || '';
  const n = (f.name || '').toLowerCase();
  if (t.startsWith('image/')) return '🖼️';
  if (t === 'application/pdf' || n.endsWith('.pdf')) return '📄';
  if (t.startsWith('video/')) return '🎬';
  if (t.startsWith('audio/')) return '🎵';
  if (/\.(zip|rar|7z|tar|gz)$/.test(n)) return '🗜️';
  if (/\.(doc|docx|txt|md|rtf)$/.test(n)) return '📝';
  if (/\.(xls|xlsx|csv)$/.test(n)) return '📊';
  if (/\.(ppt|pptx|key)$/.test(n)) return '📑';
  if (/\.(fig|sketch|xd|psd|ai)$/.test(n)) return '🎨';
  return '📎';
}

function toast(msg) {
  const existing = document.getElementById('cred-toast');
  if (existing) existing.remove();
  const el = document.createElement('div');
  el.id = 'cred-toast';
  el.className = 'toast show';
  el.textContent = msg;
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 1800);
}

async function handleFiles(fileList) {
  const clientId = store.state.ui.clientId;
  for (const file of fileList) {
    if (file.size > MAX_FILE_BYTES) {
      uploads.set(file.name, { state: 'error', msg: 'too big (max 9 MB)' });
      store.uiMutate(() => {});
      setTimeout(() => { uploads.delete(file.name); store.uiMutate(() => {}); }, 4000);
      continue;
    }
    uploads.set(file.name, { state: 'upload', msg: 'encrypting…' });
    store.uiMutate(() => {});

    try {
      const buf = await file.arrayBuffer();
      const bytes = new Uint8Array(buf);
      uploads.set(file.name, { state: 'upload', msg: 'uploading…' });
      store.uiMutate(() => {});
      const encrypted = await cryptoLib.encryptBytes(bytes);
      const id = store.uid('f').replace('f_', 'f') + '-' + Math.random().toString(36).slice(2, 7);
      await api.putVaultFile(id, encrypted);
      store.recordVaultFile(clientId, {
        id,
        name: file.name,
        size: file.size,
        type: file.type || 'application/octet-stream'
      });
      uploads.set(file.name, { state: 'done', msg: 'done ✓' });
      store.uiMutate(() => {});
      setTimeout(() => { uploads.delete(file.name); store.uiMutate(() => {}); }, 1600);
    } catch (e) {
      uploads.set(file.name, { state: 'error', msg: 'failed: ' + (e.message || e) });
      store.uiMutate(() => {});
      setTimeout(() => { uploads.delete(file.name); store.uiMutate(() => {}); }, 5000);
    }
  }
}

async function downloadFile(fileId) {
  const client = store.getClient(store.state.ui.clientId);
  const meta = client?.files?.find(f => f.id === fileId);
  if (!meta) return;
  try {
    toast('Decrypting…');
    const encrypted = await api.fetchVaultFile(fileId);
    if (!encrypted) { toast('⚠ File missing on server'); return; }
    const plain = await cryptoLib.decryptBytes(encrypted);
    const blob = new Blob([plain], { type: meta.type || 'application/octet-stream' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = meta.name;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 2000);
  } catch (e) {
    toast('⚠ ' + (e.message || e));
  }
}

async function removeFile(fileId) {
  if (!confirm('Delete this file permanently?')) return;
  try {
    await api.deleteVaultFile(fileId);
    store.removeVaultFile(store.state.ui.clientId, fileId);
    toast('✓ Deleted');
  } catch (e) {
    toast('⚠ ' + (e.message || e));
  }
}

export function wireEvents(root) {
  root.addEventListener('click', (e) => {
    const el = e.target.closest('[data-action]');
    if (!el) return;
    const a = el.dataset.action;

    if (a === 'click-upload') {
      const inp = document.getElementById('vault-file-input');
      if (inp) inp.click();
    } else if (a === 'download') {
      downloadFile(el.dataset.id);
    } else if (a === 'delete-file') {
      removeFile(el.dataset.id);
    } else if (a === 'rename') {
      const client = store.getClient(store.state.ui.clientId);
      const f = client?.files?.find(f => f.id === el.dataset.id);
      if (!f) return;
      const newName = prompt('Rename file:', f.name);
      if (newName && newName.trim() && newName !== f.name) {
        store.updateVaultFile(store.state.ui.clientId, el.dataset.id, { name: newName.trim() });
      }
    }
  });

  const input = document.getElementById('vault-file-input');
  if (input) {
    input.addEventListener('change', (e) => {
      if (e.target.files && e.target.files.length) handleFiles([...e.target.files]);
      e.target.value = '';
    });
  }

  const drop = root.querySelector('.vault-drop');
  if (drop) {
    drop.addEventListener('dragover', (e) => { e.preventDefault(); drop.classList.add('drag'); });
    drop.addEventListener('dragleave', () => drop.classList.remove('drag'));
    drop.addEventListener('drop', (e) => {
      e.preventDefault();
      drop.classList.remove('drag');
      if (e.dataTransfer.files && e.dataTransfer.files.length) handleFiles([...e.dataTransfer.files]);
    });
  }
}
