// Bootstrap: token check → fetch blob → setup or unlock → mount app.

import * as cryptoLib from '/crypto.js';
import * as api from '/api.js';
import * as store from '/store.js';
import { h, formatTime, initials, avatarStyle } from '/ui.js';
import { AVATAR_COLORS } from '/data.js';
import * as todayView   from '/views/today.js';
import * as clientView  from '/views/clientView.js';
import * as projectView from '/views/projectView.js';
import * as modals      from '/views/modals.js';
import * as palette     from '/views/palette.js';

const EMPTY_DB = {
  version: 1, createdAt: null, updatedAt: null,
  clients: [], projects: [], tasks: [], sites: [], templates: [], timeLogs: [], settings: {}
};

const bootState = { blobBytes: null, idleTimer: null };
const IDLE_LOCK_MS = 30 * 60 * 1000;

// ─── gate screens ────────────────────────────────────
const screens = ['boot', 'token', 'setup', 'unlock'];
function showGate(name) {
  screens.forEach((n) => { document.getElementById('screen-' + n).hidden = n !== name; });
  document.getElementById('gate').style.display = 'flex';
  document.getElementById('app').classList.remove('show');
}
function showApp() {
  document.getElementById('gate').style.display = 'none';
  document.getElementById('app').classList.add('show');
  renderApp();
  armIdleLock();
}

function msg(screenName, text, kind) {
  const el = document.getElementById(screenName + '-msg');
  if (!text) { el.innerHTML = ''; return; }
  el.innerHTML = `<div class="msg ${kind}">${text}</div>`;
}
function setLoading(btnId, loading, label) {
  const btn = document.getElementById(btnId);
  if (loading) { btn.dataset.label = btn.textContent; btn.disabled = true; btn.textContent = label || 'Working…'; }
  else { btn.disabled = false; btn.textContent = btn.dataset.label || btn.textContent; }
}

// ─── boot ────────────────────────────────────────────
async function boot() {
  if (!api.getToken()) { showGate('token'); return; }
  try {
    const blob = await api.fetchBlob();
    if (blob === null) showGate('setup');
    else { bootState.blobBytes = blob; showGate('unlock'); }
  } catch (e) {
    msg('token', e.message === 'BAD_TOKEN'
      ? 'The token saved on this device is not accepted. Paste it again.'
      : 'Could not reach the server: ' + e.message, 'err');
    showGate('token');
  }
}

// Token save
document.getElementById('token-btn').addEventListener('click', () => {
  const t = document.getElementById('token-input').value.trim();
  if (!t) { msg('token', 'Paste the token first.', 'err'); return; }
  api.setToken(t);
  msg('token', '', '');
  showGate('boot'); boot();
});

// First-time setup
document.getElementById('setup-btn').addEventListener('click', async () => {
  const pw = document.getElementById('setup-pw').value;
  const pw2 = document.getElementById('setup-pw2').value;
  if (pw.length < 10) { msg('setup', 'Password must be at least 10 characters.', 'err'); return; }
  if (pw !== pw2) { msg('setup', 'The two passwords do not match.', 'err'); return; }
  setLoading('setup-btn', true, 'Creating vault…');
  msg('setup', '', '');
  try {
    await cryptoLib.setup(pw);
    const now = Date.now();
    const db = { ...EMPTY_DB, createdAt: now, updatedAt: now };
    const bytes = await cryptoLib.encrypt(db);
    await api.putBlob(bytes);
    store.setDb(db);
    showApp();
  } catch (e) {
    msg('setup', 'Could not create vault: ' + e.message, 'err');
  } finally { setLoading('setup-btn', false); }
});

// Unlock
document.getElementById('unlock-btn').addEventListener('click', async () => {
  const pw = document.getElementById('unlock-pw').value;
  if (!pw) return;
  setLoading('unlock-btn', true, 'Unlocking…');
  msg('unlock', '', '');
  try {
    const db = await cryptoLib.unlock(pw, bootState.blobBytes);
    document.getElementById('unlock-pw').value = '';
    store.setDb(db);
    showApp();
  } catch (e) {
    msg('unlock', e.message === 'WRONG_PASSWORD' ? 'Wrong password.' : ('Could not unlock: ' + e.message), 'err');
  } finally { setLoading('unlock-btn', false); }
});
document.getElementById('unlock-pw').addEventListener('keydown', (e) => { if (e.key === 'Enter') document.getElementById('unlock-btn').click(); });
document.getElementById('setup-pw2').addEventListener('keydown', (e) => { if (e.key === 'Enter') document.getElementById('setup-btn').click(); });
document.getElementById('token-input').addEventListener('keydown', (e) => { if (e.key === 'Enter') document.getElementById('token-btn').click(); });
document.getElementById('forget-device-btn').addEventListener('click', () => {
  if (!confirm('Clear the saved access token on this device?')) return;
  api.clearToken();
  showGate('token');
});

// ─── post-unlock render ──────────────────────────────
function renderApp() {
  const app = document.getElementById('app');
  const db = store.state.db;
  if (!db) return;

  // Preserve focused input across re-render.
  const focused = document.activeElement;
  const focusInfo = (focused && (focused.tagName === 'INPUT' || focused.tagName === 'TEXTAREA' || focused.tagName === 'SELECT'))
    ? {
        id: focused.id || null,
        action: focused.dataset?.action || null,
        tag: focused.tagName,
        value: focused.value,
        selStart: focused.selectionStart,
        selEnd: focused.selectionEnd
      }
    : null;

  app.innerHTML = `
    <div class="shell">
      <aside class="sb">
        <div class="sb-brand">
          <div class="sb-brand-ico">
            <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
              <rect x="2" y="2" width="6" height="6" rx="1.5" fill="white"/>
              <rect x="10" y="2" width="6" height="6" rx="1.5" fill="white" opacity=".6"/>
              <rect x="2" y="10" width="6" height="6" rx="1.5" fill="white" opacity=".6"/>
              <rect x="10" y="10" width="6" height="6" rx="1.5" fill="white" opacity=".35"/>
            </svg>
          </div>
          <div>
            <div class="sb-brand-name">WP Studio</div>
            <div class="sb-brand-sub">client tracker</div>
          </div>
        </div>

        <nav class="sb-nav">
          <button class="sb-nav-item ${store.state.ui.view === 'today' ? 'active' : ''}" data-nav="today">🏠 Today</button>
          <button class="sb-nav-item" data-action="open-palette">⌘K Jump to…</button>
        </nav>

        <button class="sb-add" data-action="new-client">
          <svg width="12" height="12" viewBox="0 0 13 13" fill="none"><path d="M6.5 1v11M1 6.5h11" stroke="white" stroke-width="1.8" stroke-linecap="round"/></svg>
          New Client
        </button>

        <div class="sb-lbl">Clients (${db.clients.length})</div>
        <div class="sb-list">
          ${db.clients.length === 0
            ? `<div class="sb-empty">No clients yet.<br>Click "+ New Client" above.</div>`
            : db.clients.map(c => clientSidebarRow(c)).join('')}
        </div>

        <div class="sb-foot">
          <div class="sb-save">${saveStatus()}</div>
          <button class="sb-lock" data-action="lock">🔒 Lock</button>
        </div>
      </aside>

      <main class="main-wrap">
        <div class="main-content" id="main-content">${mainContent()}</div>
      </main>
    </div>

    <div id="modal-slot">${modals.render()}</div>
    <div id="palette-slot">${palette.render()}</div>
  `;

  wireShell(app);
  const mainEl = document.getElementById('main-content');
  const view = store.state.ui.view;
  if (view === 'today')   todayView.wireEvents(mainEl);
  if (view === 'client')  clientView.wireEvents(mainEl);
  if (view === 'project') projectView.wireEvents(mainEl);

  const modalSlot = document.getElementById('modal-slot');
  if (modalSlot.children.length) modals.wireEvents(modalSlot);
  const paletteSlot = document.getElementById('palette-slot');
  if (paletteSlot.children.length) palette.wireEvents(paletteSlot);

  // Restore focus.
  if (focusInfo) {
    let el = null;
    if (focusInfo.id) el = document.getElementById(focusInfo.id);
    else if (focusInfo.action) el = document.querySelector(`[data-action="${focusInfo.action}"]`);
    if (el && el.tagName === focusInfo.tag) {
      if (el.value !== focusInfo.value && typeof el.value === 'string') el.value = focusInfo.value;
      el.focus();
      if (typeof focusInfo.selStart === 'number' && el.setSelectionRange) {
        try { el.setSelectionRange(focusInfo.selStart, focusInfo.selEnd); } catch {}
      }
    }
  }
}

function mainContent() {
  const view = store.state.ui.view;
  if (view === 'today')   return todayView.render();
  if (view === 'client')  return clientView.render();
  if (view === 'project') return projectView.render();
  return todayView.render();
}

function clientSidebarRow(c) {
  const prog = store.clientProgress(c.id);
  const active = store.state.ui.view === 'client' && store.state.ui.clientId === c.id;
  return `
    <div class="sb-cl ${active ? 'active' : ''}" data-action="open-client" data-id="${c.id}">
      <div class="sb-cl-av" style="${avatarStyle(c, AVATAR_COLORS)}">${initials(c.name)}</div>
      <div class="sb-cl-meta">
        <div class="sb-cl-name">${h(c.name)}</div>
        <div class="sb-cl-niche">${h(c.niche || '—')}</div>
      </div>
      <div class="sb-cl-pct">${prog.pct}%</div>
    </div>
  `;
}

function saveStatus() {
  const s = store.state;
  if (s.saving) return '💾 saving…';
  if (s.lastError) return `⚠ ${s.lastError}`;
  if (s.dirty) return '• unsaved';
  if (s.lastSavedAt) return `✓ saved ${formatTime(s.lastSavedAt)}`;
  return '✓ saved';
}

function wireShell(app) {
  app.addEventListener('click', (e) => {
    const el = e.target.closest('[data-action], [data-nav]');
    if (!el) return;
    if (el.dataset.nav === 'today') {
      store.uiMutate(ui => { ui.view = 'today'; });
    } else if (el.dataset.action === 'open-client') {
      store.uiMutate(ui => { ui.view = 'client'; ui.clientId = el.dataset.id; ui.clientTab = 'projects'; });
    } else if (el.dataset.action === 'new-client') {
      store.uiMutate(ui => { ui.modal = { kind: 'new-client' }; });
    } else if (el.dataset.action === 'lock') {
      lock();
    } else if (el.dataset.action === 'open-palette') {
      palette.open();
    }
  });
}

// Re-render on any state change.
store.subscribe(() => {
  if (document.getElementById('app').classList.contains('show')) renderApp();
});

// ─── keyboard: Ctrl+K / Cmd+K ────────────────────────
document.addEventListener('keydown', (e) => {
  if ((e.key === 'k' || e.key === 'K') && (e.ctrlKey || e.metaKey)) {
    e.preventDefault();
    if (document.getElementById('app').classList.contains('show')) {
      palette.open();
    }
  }
});

// ─── lock / idle ─────────────────────────────────────
function lock() {
  cryptoLib.lock();
  store.setDb(null);
  bootState.blobBytes = null;
  clearTimeout(bootState.idleTimer);
  showGate('boot'); boot();
}

function armIdleLock() {
  const reset = () => {
    clearTimeout(bootState.idleTimer);
    bootState.idleTimer = setTimeout(lock, IDLE_LOCK_MS);
  };
  reset();
  ['mousedown', 'keydown', 'touchstart'].forEach(ev => document.addEventListener(ev, reset, { passive: true }));
}

// ─── go ──────────────────────────────────────────────
boot();
