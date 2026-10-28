// Settings — daily budget, pomodoro, idle lock, full data export, danger zone.

import * as store from '../store.js';
import * as cryptoLib from '../crypto.js';
import { h, formatDate } from '../ui.js';

export function render() {
  const s = store.state.db.settings || {};
  const db = store.state.db;

  const sizes = {
    clients: db.clients.length,
    projects: db.projects.length,
    tasks: db.tasks.length,
    sites: db.sites.length,
    files: db.clients.reduce((a, c) => a + (c.files?.length || 0), 0),
    logs: db.timeLogs.length,
    creds: db.clients.reduce((a, c) => a + (c.credentials?.length || 0), 0)
  };

  return `
    <div class="settings-view">
      <div class="pv-hdr">
        <div class="pv-crumbs"><span>Settings</span></div>
      </div>

      <div class="settings-grid">
        <div class="settings-card">
          <div class="settings-card-h">🧾 Your business</div>
          <div class="settings-text">Used as the footer on every maintenance report PDF. Leave blank to omit.</div>
          <div class="settings-row">
            <div><div class="settings-row-l">Business name</div></div>
            <input class="settings-input" value="${h(s.business?.name || '')}" placeholder="Your Studio Ltd." data-setting-biz="name">
          </div>
          <div class="settings-row">
            <div><div class="settings-row-l">Email</div></div>
            <input class="settings-input" value="${h(s.business?.email || '')}" placeholder="hello@yourstudio.com" data-setting-biz="email">
          </div>
          <div class="settings-row">
            <div><div class="settings-row-l">Phone</div></div>
            <input class="settings-input" value="${h(s.business?.phone || '')}" placeholder="+94 ..." data-setting-biz="phone">
          </div>
          <div class="settings-row">
            <div><div class="settings-row-l">Website</div></div>
            <input class="settings-input" value="${h(s.business?.website || '')}" placeholder="yourstudio.com" data-setting-biz="website">
          </div>
          <div class="settings-row">
            <div><div class="settings-row-l">Address</div></div>
            <input class="settings-input" value="${h(s.business?.address || '')}" placeholder="Colombo, Sri Lanka" data-setting-biz="address">
          </div>
        </div>

        <div class="settings-card">
          <div class="settings-card-h">⏱ Time</div>

          <div class="settings-row">
            <div>
              <div class="settings-row-l">Daily time budget</div>
              <div class="settings-row-s">Shows a progress bar on Today. Blank = no budget.</div>
            </div>
            <input class="settings-input" type="text" value="${h(fmtBudget(s.dailyBudgetMinutes))}"
              placeholder="e.g. 5h" data-setting="dailyBudgetMinutes" data-parse="duration">
          </div>

          <div class="settings-row">
            <div>
              <div class="settings-row-l">Pomodoro mode</div>
              <div class="settings-row-s">Auto-stop timers after a focus period and prompt a break.</div>
            </div>
            <label class="switch">
              <input type="checkbox" ${s.pomodoroEnabled ? 'checked' : ''} data-setting="pomodoroEnabled" data-parse="bool">
              <span class="switch-slider"></span>
            </label>
          </div>

          ${s.pomodoroEnabled ? `
            <div class="settings-row">
              <div>
                <div class="settings-row-l">Focus length</div>
                <div class="settings-row-s">Default 25 min.</div>
              </div>
              <input class="settings-input settings-input-sm" type="number" min="1" max="180" value="${s.pomodoroFocusMinutes || 25}" data-setting="pomodoroFocusMinutes" data-parse="int">
            </div>
            <div class="settings-row">
              <div>
                <div class="settings-row-l">Break length</div>
                <div class="settings-row-s">Default 5 min.</div>
              </div>
              <input class="settings-input settings-input-sm" type="number" min="1" max="60" value="${s.pomodoroBreakMinutes || 5}" data-setting="pomodoroBreakMinutes" data-parse="int">
            </div>
          ` : ''}
        </div>

        <div class="settings-card">
          <div class="settings-card-h">🔒 Security</div>

          <div class="settings-row">
            <div>
              <div class="settings-row-l">Idle auto-lock</div>
              <div class="settings-row-s">Minutes of inactivity before vault re-locks.</div>
            </div>
            <input class="settings-input settings-input-sm" type="number" min="1" max="240" value="${s.idleLockMinutes || 30}" data-setting="idleLockMinutes" data-parse="int">
          </div>
        </div>

        <div class="settings-card">
          <div class="settings-card-h">📦 Backup</div>
          <div class="settings-text">
            Download an encrypted copy of your vault (same ciphertext stored on Vercel).
            Keep it on an external drive — restore by uploading to the same vercel blob store, or by swapping the file in Vercel Blob.
          </div>
          <div class="settings-stats">
            ${sizes.clients} clients · ${sizes.projects} projects · ${sizes.tasks} tasks ·
            ${sizes.sites} sites · ${sizes.creds} credentials · ${sizes.files} files · ${sizes.logs} time logs
          </div>
          <button class="btn-primary btn-sm" data-action="export-encrypted">⇩ Download encrypted backup (.wps)</button>
          <button class="btn-ghost btn-sm" data-action="export-plain">⇩ Download unencrypted JSON (plaintext)</button>
          <div class="settings-text" style="margin-top:10px;color:var(--rose)">
            Plaintext export contains every credential, note, and file metadata readable. Only use for migrating.
          </div>
        </div>

        <div class="settings-card settings-card-danger">
          <div class="settings-card-h">⚠ Danger zone</div>
          <div class="settings-text">Delete everything in your vault. Cannot be undone. Encrypted backup is strongly recommended first.</div>
          <button class="btn-del" data-action="wipe-all">Delete all data</button>
        </div>

        <div class="settings-card">
          <div class="settings-card-h">About</div>
          <div class="settings-text">
            WP Studio — zero-knowledge client tracker for solo web developers.
            Your data is AES-256-GCM encrypted in your browser; the server stores ciphertext only.
          </div>
          <div class="settings-text" style="font-family:var(--ff-mono);font-size:10.5px;color:var(--ink4)">
            Last saved: ${store.state.lastSavedAt ? formatDate(store.state.lastSavedAt) + ' ' + new Date(store.state.lastSavedAt).toLocaleTimeString() : 'never'}
          </div>
        </div>
      </div>
    </div>
  `;
}

function fmtBudget(mins) {
  if (!mins) return '';
  if (mins < 60) return mins + 'm';
  const h = Math.floor(mins / 60), r = mins % 60;
  return r ? `${h}h${r}m` : `${h}h`;
}

function parseDuration(s) {
  if (!s) return 0;
  s = String(s).trim().toLowerCase().replace(/\s+/g, '');
  if (!s) return 0;
  let total = 0;
  const h = s.match(/(\d+)h/);
  const m = s.match(/(\d+)m/);
  if (h) total += parseInt(h[1], 10) * 60;
  if (m) total += parseInt(m[1], 10);
  if (!h && !m) {
    const n = parseInt(s, 10);
    if (!isNaN(n)) total = n;
  }
  return Math.max(0, total);
}

async function exportEncrypted() {
  const bytes = await cryptoLib.encrypt(store.state.db);
  const blob = new Blob([bytes], { type: 'application/octet-stream' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `wp-studio-${new Date().toISOString().slice(0, 10)}.wps`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1500);
}

function exportPlain() {
  if (!confirm('This downloads your data as PLAINTEXT JSON — credentials and notes will be readable by anyone who opens the file. Continue?')) return;
  const json = JSON.stringify(store.state.db, null, 2);
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `wp-studio-${new Date().toISOString().slice(0, 10)}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1500);
}

async function wipeAll() {
  if (!confirm('This DELETES EVERYTHING — all clients, projects, tasks, credentials, time logs, and the local metadata for your vault files. The vault files themselves stay on the server until you remove them manually. Type DELETE in the next prompt to confirm.')) return;
  const ans = prompt('Type DELETE to confirm:');
  if (ans !== 'DELETE') return;
  store.mutate(db => {
    db.clients = [];
    db.projects = [];
    db.tasks = [];
    db.sites = [];
    db.timeLogs = [];
    // Keep templates and settings.
  });
  alert('Done. Vault emptied.');
  store.uiMutate(ui => { ui.view = 'today'; });
}

let bizTimer = null;

export function wireEvents(root) {
  root.addEventListener('change', (e) => {
    const el = e.target.closest('[data-setting], [data-setting-biz]');
    if (!el) return;
    if (el.dataset.settingBiz) {
      const key = el.dataset.settingBiz;
      const biz = { ...(store.state.db.settings.business || {}), [key]: el.value };
      store.updateSettings({ business: biz });
      return;
    }
    const key = el.dataset.setting;
    const parse = el.dataset.parse;
    let value;
    if (parse === 'bool') value = el.checked;
    else if (parse === 'int') value = parseInt(el.value, 10) || 0;
    else if (parse === 'duration') value = parseDuration(el.value);
    else value = el.value;
    store.updateSettings({ [key]: value });
  });

  // Also save business inputs on blur for live-typing experience.
  root.addEventListener('input', (e) => {
    const el = e.target.closest('[data-setting-biz]');
    if (!el) return;
    clearTimeout(bizTimer);
    bizTimer = setTimeout(() => {
      const key = el.dataset.settingBiz;
      const biz = { ...(store.state.db.settings.business || {}), [key]: el.value };
      store.updateSettings({ business: biz });
    }, 500);
  });

  root.addEventListener('click', (e) => {
    const el = e.target.closest('[data-action]');
    if (!el) return;
    const a = el.dataset.action;
    if (a === 'export-encrypted') exportEncrypted();
    else if (a === 'export-plain') exportPlain();
    else if (a === 'wipe-all') wipeAll();
  });
}
