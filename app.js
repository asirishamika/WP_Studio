// Bootstrap: token check → fetch blob → setup or unlock → app.
// Phase 1 only wires the gate and the encrypted round-trip; later phases
// will mount the modules (clients, projects, tasks, vault, time, sites).

import * as cryptoLib from '/crypto.js';
import * as store from '/store.js';

const EMPTY_DB = {
  version: 1,
  createdAt: null,
  updatedAt: null,
  clients: [],
  projects: [],
  tasks: [],
  sites: [],
  templates: [],
  timeLogs: [],
  settings: {}
};

const state = {
  db: null,
  blobBytes: null,
  idleTimer: null
};

const IDLE_LOCK_MS = 30 * 60 * 1000;

// ─── screens ─────────────────────────────────────────
const screens = ['boot', 'token', 'setup', 'unlock'];
function show(name) {
  screens.forEach((n) => {
    document.getElementById('screen-' + n).hidden = n !== name;
  });
  document.getElementById('gate').style.display = 'flex';
  document.getElementById('app').classList.remove('show');
}
function showApp() {
  document.getElementById('gate').style.display = 'none';
  document.getElementById('app').classList.add('show');
  renderAppStats();
  armIdleLock();
}

function msg(screenName, text, kind) {
  const el = document.getElementById(screenName + '-msg');
  if (!text) { el.innerHTML = ''; return; }
  el.innerHTML = `<div class="msg ${kind}">${text}</div>`;
}

function setLoading(btnId, loading, originalLabel) {
  const btn = document.getElementById(btnId);
  if (loading) {
    btn.dataset.label = btn.textContent;
    btn.disabled = true;
    btn.textContent = originalLabel || 'Working…';
  } else {
    btn.disabled = false;
    btn.textContent = btn.dataset.label || btn.textContent;
  }
}

// ─── boot flow ───────────────────────────────────────
async function boot() {
  if (!store.getToken()) {
    show('token');
    return;
  }
  try {
    const blob = await store.fetchBlob();
    if (blob === null) {
      show('setup');
    } else {
      state.blobBytes = blob;
      show('unlock');
    }
  } catch (e) {
    if (e.message === 'BAD_TOKEN') {
      msg('token', 'The token saved on this device is not accepted. Paste it again.', 'err');
      show('token');
    } else {
      msg('token', 'Could not reach the server: ' + e.message, 'err');
      show('token');
    }
  }
}

// ─── token screen ────────────────────────────────────
document.getElementById('token-btn').addEventListener('click', async () => {
  const t = document.getElementById('token-input').value.trim();
  if (!t) {
    msg('token', 'Paste the token first.', 'err');
    return;
  }
  store.setToken(t);
  msg('token', '', '');
  show('boot');
  boot();
});

// ─── setup (first time) ──────────────────────────────
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
    state.db = { ...EMPTY_DB, createdAt: now, updatedAt: now };
    const bytes = await cryptoLib.encrypt(state.db);
    const result = await store.putBlob(bytes);
    state.db.updatedAt = result.uploadedAt ? new Date(result.uploadedAt).getTime() : now;
    showApp();
  } catch (e) {
    msg('setup', 'Could not create vault: ' + e.message, 'err');
  } finally {
    setLoading('setup-btn', false);
  }
});

// ─── unlock ──────────────────────────────────────────
document.getElementById('unlock-btn').addEventListener('click', async () => {
  const pw = document.getElementById('unlock-pw').value;
  if (!pw) return;

  setLoading('unlock-btn', true, 'Unlocking…');
  msg('unlock', '', '');
  try {
    state.db = await cryptoLib.unlock(pw, state.blobBytes);
    document.getElementById('unlock-pw').value = '';
    showApp();
  } catch (e) {
    if (e.message === 'WRONG_PASSWORD') {
      msg('unlock', 'Wrong password.', 'err');
    } else {
      msg('unlock', 'Could not unlock: ' + e.message, 'err');
    }
  } finally {
    setLoading('unlock-btn', false);
  }
});
document.getElementById('unlock-pw').addEventListener('keydown', (e) => {
  if (e.key === 'Enter') document.getElementById('unlock-btn').click();
});
document.getElementById('setup-pw2').addEventListener('keydown', (e) => {
  if (e.key === 'Enter') document.getElementById('setup-btn').click();
});
document.getElementById('token-input').addEventListener('keydown', (e) => {
  if (e.key === 'Enter') document.getElementById('token-btn').click();
});

document.getElementById('forget-device-btn').addEventListener('click', () => {
  if (!confirm('Clear the saved access token on this device? You will need to paste it again next time.')) return;
  store.clearToken();
  show('token');
});

// ─── post-unlock ─────────────────────────────────────
function renderAppStats() {
  const d = state.db;
  document.getElementById('db-stats').textContent =
    `${d.clients.length} clients, ${d.projects.length} projects, ${d.tasks.length} tasks`;
  document.getElementById('db-time').textContent =
    '● updated ' + (d.updatedAt ? new Date(d.updatedAt).toLocaleString() : '—');
}

function lock() {
  cryptoLib.lock();
  state.db = null;
  state.blobBytes = null;
  clearTimeout(state.idleTimer);
  show('boot');
  boot();
}

document.getElementById('lock-btn').addEventListener('click', lock);

function armIdleLock() {
  clearTimeout(state.idleTimer);
  const reset = () => {
    clearTimeout(state.idleTimer);
    state.idleTimer = setTimeout(lock, IDLE_LOCK_MS);
  };
  reset();
  ['mousedown', 'keydown', 'touchstart'].forEach((ev) =>
    document.addEventListener(ev, reset, { passive: true })
  );
}

// ─── go ──────────────────────────────────────────────
boot();
