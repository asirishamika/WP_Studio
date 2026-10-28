// Reactive state store + debounced encrypted auto-save.
// All mutations go through mutate() so the dirty flag + save timer trigger.
// Views subscribe() for re-renders.

import * as api from './api.js';
import * as cryptoLib from './crypto.js';
import { BUILTIN_TEMPLATES } from './data.js';

export const state = {
  db: null,
  dirty: false,
  saving: false,
  lastSavedAt: null,
  lastError: null,
  timer: null,              // { taskId, startedAt } — active stopwatch (session-only)
  ui: {
    view: 'today',          // 'today' | 'clients' | 'client' | 'project' | 'templates'
    clientId: null,
    projectId: null,
    clientTab: 'projects',  // 'projects' | 'credentials' | 'files'
    paletteOpen: false,
    modal: null,            // { kind, ...payload }
  }
};

const listeners = new Set();
let emitScheduled = false;

export function subscribe(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

function emit() {
  if (emitScheduled) return;
  emitScheduled = true;
  queueMicrotask(() => {
    emitScheduled = false;
    for (const fn of listeners) fn(state);
  });
}

// ─── bootstrap ───────────────────────────────────────
export function setDb(db) {
  state.db = ensureShape(db);
  emit();
}

function ensureShape(db) {
  db.clients  = db.clients  || [];
  db.projects = db.projects || [];
  db.tasks    = db.tasks    || [];
  db.sites    = db.sites    || [];
  db.timeLogs = db.timeLogs || [];
  db.templates= db.templates|| [];
  db.settings = db.settings || {};
  // Settings defaults.
  if (db.settings.dailyBudgetMinutes == null) db.settings.dailyBudgetMinutes = 0;      // 0 = no budget
  if (db.settings.pomodoroEnabled == null)    db.settings.pomodoroEnabled = false;
  if (db.settings.pomodoroFocusMinutes == null) db.settings.pomodoroFocusMinutes = 25;
  if (db.settings.pomodoroBreakMinutes == null) db.settings.pomodoroBreakMinutes = 5;
  if (db.settings.idleLockMinutes == null)    db.settings.idleLockMinutes = 30;
  if (!db.settings.business)                  db.settings.business = { name: '', email: '', phone: '', website: '', address: '' };
  // Backfill maintenance/renewal fields on existing clients.
  for (const c of db.clients) {
    if (c.hasMaintenance == null) c.hasMaintenance = false;
    if (!c.maintenanceEntries) c.maintenanceEntries = [];
    if (!c.renewals) c.renewals = [];
  }
  if (db.templates.length === 0) {
    db.templates = JSON.parse(JSON.stringify(BUILTIN_TEMPLATES));
  }
  return db;
}

export function updateSettings(patch) {
  mutate(db => {
    db.settings = { ...db.settings, ...patch };
  });
}

// ─── mutate ──────────────────────────────────────────
export function mutate(fn) {
  if (!state.db) return;
  fn(state.db);
  state.db.updatedAt = Date.now();
  state.dirty = true;
  state.lastError = null;
  emit();
  scheduleSave();
}

export function uiMutate(fn) {
  fn(state.ui);
  emit();
}

// ─── save ────────────────────────────────────────────
const SAVE_DELAY_MS = 1200;
let saveTimer = null;

function scheduleSave() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => { doSave(); }, SAVE_DELAY_MS);
}

async function doSave() {
  if (!state.db || !cryptoLib.isUnlocked()) return;
  if (state.saving) { scheduleSave(); return; }
  state.saving = true;
  const wasDirty = state.dirty;
  state.dirty = false;
  emit();
  try {
    const bytes = await cryptoLib.encrypt(state.db);
    const result = await api.putBlob(bytes);
    state.lastSavedAt = result.uploadedAt ? new Date(result.uploadedAt).getTime() : Date.now();
    state.lastError = null;
  } catch (e) {
    state.dirty = true; // mark dirty again so we retry later
    state.lastError = e.message || String(e);
    scheduleSave();
  } finally {
    state.saving = false;
    emit();
  }
}

// Force an immediate save (e.g. before page unload).
export async function flushSave() {
  clearTimeout(saveTimer);
  await doSave();
}

window.addEventListener('beforeunload', (e) => {
  if (state.dirty) {
    e.preventDefault();
    e.returnValue = '';
    flushSave();
  }
});

// ─── ids ─────────────────────────────────────────────
export function uid(prefix) {
  return `${prefix}_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;
}

// ─── CLIENT ──────────────────────────────────────────
export function addClient(data) {
  const id = uid('cl');
  const now = Date.now();
  mutate(db => {
    db.clients.push({
      id,
      name: data.name || 'Untitled client',
      niche: data.niche || '',
      contactName: data.contactName || '',
      contactEmail: data.contactEmail || '',
      avatarIndex: data.avatarIndex ?? 0,
      notes: data.notes || '',
      credentials: [],
      files: [],
      bitwardenCollection: '',
      hasMaintenance: !!data.hasMaintenance,
      maintenancePlan: data.maintenancePlan || null,  // { fee, frequency, startedAt }
      maintenanceEntries: [],                          // [{id,date,task,notes,sent}]
      renewals: [],                                    // [{id,kind,provider,expiresAt,cost,autoRenew,url,notes}]
      createdAt: now,
      updatedAt: now
    });
  });
  return id;
}

export function updateClient(id, patch) {
  mutate(db => {
    const c = db.clients.find(c => c.id === id);
    if (!c) return;
    Object.assign(c, patch, { updatedAt: Date.now() });
  });
}

export function deleteClient(id) {
  mutate(db => {
    db.clients = db.clients.filter(c => c.id !== id);
    const projectIds = db.projects.filter(p => p.clientId === id).map(p => p.id);
    db.projects = db.projects.filter(p => p.clientId !== id);
    db.tasks = db.tasks.filter(t => !projectIds.includes(t.projectId));
    db.sites = db.sites.filter(s => s.clientId !== id);
  });
}

// ─── SITES ───────────────────────────────────────────
export function addSite(data) {
  const id = uid('st');
  const now = Date.now();
  mutate(db => {
    db.sites.push({
      id,
      clientId: data.clientId,
      url: data.url,
      label: data.label || '',
      monitored: false,       // opt-in to background cron
      createdAt: now,
      checkedAt: null,
      up: null,
      statusCode: null,
      latencyMs: null,
      sslDaysLeft: null,
      sslExpires: null,
      sslIssuer: null,
      isWordPress: null,
      wpVersion: null,
      error: null
    });
  });
  return id;
}

// Toggle background cron monitoring for one site. The caller should
// trigger syncMonitorSites() after to push the change to the server.
export function toggleSiteMonitored(id) {
  mutate(db => {
    const s = db.sites.find(x => x.id === id);
    if (!s) return;
    s.monitored = !s.monitored;
  });
}

// Merge an array of cron results (from /api/monitor/results) into the
// local sites — only updates sites that are currently monitored and
// only overwrites when the result is newer than what we have.
export function mergeMonitorResults(results) {
  if (!Array.isArray(results)) return 0;
  let updated = 0;
  mutate(db => {
    for (const r of results) {
      const s = db.sites.find(x => x.id === r.id);
      if (!s) continue;
      if (s.checkedAt && s.checkedAt >= r.checkedAt) continue;
      s.checkedAt = r.checkedAt;
      s.up = r.up;
      s.statusCode = r.statusCode;
      s.latencyMs = r.latencyMs;
      s.sslDaysLeft = r.sslDaysLeft;
      s.sslExpires = r.sslExpires;
      s.isWordPress = r.isWordPress;
      s.wpVersion = r.wpVersion;
      s.error = r.error;
      updated++;
    }
  });
  return updated;
}

export function monitoredSitesList() {
  return (state.db?.sites || [])
    .filter(s => s.monitored)
    .map(s => ({ id: s.id, url: s.url }));
}

export function updateSite(id, patch) {
  mutate(db => {
    const s = db.sites.find(x => x.id === id);
    if (!s) return;
    Object.assign(s, patch);
  });
}

export function deleteSite(id) {
  mutate(db => {
    db.sites = db.sites.filter(s => s.id !== id);
  });
}

export function getSite(id) {
  return state.db?.sites.find(s => s.id === id) || null;
}

export function sitesOfClient(clientId) {
  return state.db?.sites.filter(s => s.clientId === clientId) || [];
}

export function allSites() {
  return state.db?.sites || [];
}

export function siteAlerts() {
  const sites = allSites();
  const down = sites.filter(s => s.up === false);
  const sslSoon = sites.filter(s => typeof s.sslDaysLeft === 'number' && s.sslDaysLeft <= 14 && s.sslDaysLeft >= 0);
  const sslExpired = sites.filter(s => typeof s.sslDaysLeft === 'number' && s.sslDaysLeft < 0);
  return { down, sslSoon, sslExpired };
}

// ─── MAINTENANCE (per client) ────────────────────────
export function toggleMaintenance(clientId, enabled) {
  mutate(db => {
    const c = db.clients.find(c => c.id === clientId);
    if (!c) return;
    c.hasMaintenance = enabled === undefined ? !c.hasMaintenance : !!enabled;
    if (!c.maintenanceEntries) c.maintenanceEntries = [];
    c.updatedAt = Date.now();
  });
}

export function setMaintenancePlan(clientId, plan) {
  mutate(db => {
    const c = db.clients.find(c => c.id === clientId);
    if (!c) return;
    c.maintenancePlan = plan || null;
    c.updatedAt = Date.now();
  });
}

export function addMaintenanceEntry(clientId, data) {
  const id = uid('me');
  const now = Date.now();
  mutate(db => {
    const c = db.clients.find(c => c.id === clientId);
    if (!c) return;
    if (!c.maintenanceEntries) c.maintenanceEntries = [];
    c.maintenanceEntries.push({
      id,
      date: data.date || new Date().toISOString().slice(0, 10),
      task: data.task || 'Untitled work',
      notes: data.notes || '',
      hoursSpent: data.hoursSpent || null,
      sent: !!data.sent,
      createdAt: now
    });
    c.updatedAt = now;
  });
  return id;
}

export function updateMaintenanceEntry(clientId, entryId, patch) {
  mutate(db => {
    const c = db.clients.find(c => c.id === clientId);
    if (!c || !c.maintenanceEntries) return;
    const e = c.maintenanceEntries.find(x => x.id === entryId);
    if (!e) return;
    Object.assign(e, patch);
    c.updatedAt = Date.now();
  });
}

export function deleteMaintenanceEntry(clientId, entryId) {
  mutate(db => {
    const c = db.clients.find(c => c.id === clientId);
    if (!c || !c.maintenanceEntries) return;
    c.maintenanceEntries = c.maintenanceEntries.filter(e => e.id !== entryId);
    c.updatedAt = Date.now();
  });
}

export function clientsWithMaintenance() {
  return state.db?.clients.filter(c => c.hasMaintenance) || [];
}

// ─── RENEWALS (per client — domains, hosting, licences) ──────
export function addRenewal(clientId, data) {
  const id = uid('rn');
  const now = Date.now();
  mutate(db => {
    const c = db.clients.find(c => c.id === clientId);
    if (!c) return;
    if (!c.renewals) c.renewals = [];
    c.renewals.push({
      id,
      kind: data.kind || 'domain',           // domain | hosting | ssl | plugin | other
      provider: data.provider || '',
      item: data.item || '',                 // e.g. "example.com", "WP Rocket licence"
      expiresAt: data.expiresAt || '',       // ISO date
      cost: data.cost || '',
      autoRenew: !!data.autoRenew,
      url: data.url || '',                   // management panel URL
      notes: data.notes || '',
      createdAt: now,
      updatedAt: now
    });
    c.updatedAt = now;
  });
  return id;
}

export function updateRenewal(clientId, renewalId, patch) {
  mutate(db => {
    const c = db.clients.find(c => c.id === clientId);
    if (!c || !c.renewals) return;
    const r = c.renewals.find(x => x.id === renewalId);
    if (!r) return;
    Object.assign(r, patch, { updatedAt: Date.now() });
    c.updatedAt = Date.now();
  });
}

export function deleteRenewal(clientId, renewalId) {
  mutate(db => {
    const c = db.clients.find(c => c.id === clientId);
    if (!c || !c.renewals) return;
    c.renewals = c.renewals.filter(r => r.id !== renewalId);
    c.updatedAt = Date.now();
  });
}

export function allRenewals() {
  const out = [];
  const clients = state.db?.clients || [];
  for (const c of clients) {
    for (const r of (c.renewals || [])) out.push({ ...r, clientId: c.id, clientName: c.name });
  }
  return out;
}

export function renewalAlerts(windowDays = 30) {
  const now = Date.now();
  const soon = now + windowDays * 86400000;
  const all = allRenewals();
  const expired = [];
  const upcoming = [];
  for (const r of all) {
    if (!r.expiresAt) continue;
    const exp = new Date(r.expiresAt).getTime();
    if (isNaN(exp)) continue;
    if (exp < now) expired.push({ ...r, daysLeft: Math.round((exp - now) / 86400000) });
    else if (exp <= soon) upcoming.push({ ...r, daysLeft: Math.round((exp - now) / 86400000) });
  }
  upcoming.sort((a, b) => a.daysLeft - b.daysLeft);
  expired.sort((a, b) => b.daysLeft - a.daysLeft); // most-recently-expired first
  return { upcoming, expired };
}

// ─── CREDENTIALS (per client, encrypted via main DB) ─────────
export function addCredential(clientId, data) {
  const id = uid('cr');
  const now = Date.now();
  mutate(db => {
    const c = db.clients.find(c => c.id === clientId);
    if (!c) return;
    if (!c.credentials) c.credentials = [];
    c.credentials.push({
      id,
      label: data.label || 'New credential',
      url: data.url || '',
      username: data.username || '',
      password: data.password || '',
      notes: data.notes || '',
      createdAt: now,
      updatedAt: now
    });
    c.updatedAt = now;
  });
  return id;
}

export function updateCredential(clientId, credId, patch) {
  mutate(db => {
    const c = db.clients.find(c => c.id === clientId);
    if (!c || !c.credentials) return;
    const cr = c.credentials.find(x => x.id === credId);
    if (!cr) return;
    Object.assign(cr, patch, { updatedAt: Date.now() });
    c.updatedAt = Date.now();
  });
}

export function deleteCredential(clientId, credId) {
  mutate(db => {
    const c = db.clients.find(c => c.id === clientId);
    if (!c || !c.credentials) return;
    c.credentials = c.credentials.filter(x => x.id !== credId);
    c.updatedAt = Date.now();
  });
}

// ─── VAULT FILES (ciphertext blobs; metadata in main DB) ─────
// This records the file in the DB. The actual upload must already have
// completed via api.putVaultFile(id, encryptedBytes).
export function recordVaultFile(clientId, meta) {
  const now = Date.now();
  mutate(db => {
    const c = db.clients.find(c => c.id === clientId);
    if (!c) return;
    if (!c.files) c.files = [];
    c.files.push({
      id: meta.id,                 // the blob key (uuid)
      name: meta.name,
      size: meta.size,             // plaintext size
      type: meta.type,             // mime
      tag: meta.tag || '',         // credential | doc | asset | tutorial | handover | other
      pinned: !!meta.pinned,
      uploadedAt: now
    });
    c.updatedAt = now;
  });
}

export function updateVaultFile(clientId, fileId, patch) {
  mutate(db => {
    const c = db.clients.find(c => c.id === clientId);
    if (!c || !c.files) return;
    const f = c.files.find(x => x.id === fileId);
    if (!f) return;
    Object.assign(f, patch);
    c.updatedAt = Date.now();
  });
}

export function removeVaultFile(clientId, fileId) {
  mutate(db => {
    const c = db.clients.find(c => c.id === clientId);
    if (!c || !c.files) return;
    c.files = c.files.filter(f => f.id !== fileId);
    c.updatedAt = Date.now();
  });
}

export function getClient(id) {
  return state.db?.clients.find(c => c.id === id) || null;
}

// ─── PROJECT ─────────────────────────────────────────
export function addProject(data) {
  const id = uid('pr');
  const now = Date.now();
  mutate(db => {
    const template = data.templateId ? db.templates.find(t => t.id === data.templateId) : null;
    const phases = template
      ? template.phases.map(p => ({
          id: uid('ph'),
          label: p.label,
          icon: p.icon,
          color: p.color,
          templatePhaseId: p.id
        }))
      : [];
    db.projects.push({
      id,
      clientId: data.clientId,
      name: data.name || 'Untitled project',
      status: data.status || 'active',
      templateId: data.templateId || null,
      budget: data.budget || '',
      startDate: data.startDate || '',
      deadline: data.deadline || '',
      url: data.url || '',
      phases,
      notes: data.notes || '',
      createdAt: now,
      updatedAt: now
    });
    // Seed tasks from template.
    if (template) {
      for (let i = 0; i < template.phases.length; i++) {
        const srcPhase = template.phases[i];
        const destPhase = phases[i];
        for (const t of srcPhase.tasks) {
          db.tasks.push({
            id: uid('tk'),
            projectId: id,
            phaseId: destPhase.id,
            title: t.title,
            hint: t.hint || '',
            priority: t.priority || 'medium',
            done: false,
            estimateMinutes: null,
            dueDate: null,
            createdAt: now,
            updatedAt: now,
            doneAt: null
          });
        }
      }
    }
  });
  return id;
}

export function updateProject(id, patch) {
  mutate(db => {
    const p = db.projects.find(p => p.id === id);
    if (!p) return;
    Object.assign(p, patch, { updatedAt: Date.now() });
  });
}

export function deleteProject(id) {
  mutate(db => {
    db.projects = db.projects.filter(p => p.id !== id);
    db.tasks = db.tasks.filter(t => t.projectId !== id);
  });
}

export function getProject(id) {
  return state.db?.projects.find(p => p.id === id) || null;
}

export function projectsOfClient(clientId) {
  return state.db?.projects.filter(p => p.clientId === clientId) || [];
}

// ─── TASK ────────────────────────────────────────────
export function addTask(data) {
  const id = uid('tk');
  const now = Date.now();
  mutate(db => {
    db.tasks.push({
      id,
      projectId: data.projectId,
      phaseId: data.phaseId || null,
      title: data.title || 'New task',
      hint: data.hint || '',
      priority: data.priority || 'medium',
      done: false,
      estimateMinutes: data.estimateMinutes || null,
      dueDate: data.dueDate || null,
      createdAt: now,
      updatedAt: now,
      doneAt: null
    });
  });
  return id;
}

export function updateTask(id, patch) {
  mutate(db => {
    const t = db.tasks.find(t => t.id === id);
    if (!t) return;
    Object.assign(t, patch, { updatedAt: Date.now() });
  });
}

export function toggleTask(id) {
  mutate(db => {
    const t = db.tasks.find(t => t.id === id);
    if (!t) return;
    t.done = !t.done;
    t.doneAt = t.done ? Date.now() : null;
    t.updatedAt = Date.now();
  });
}

export function deleteTask(id) {
  mutate(db => {
    db.tasks = db.tasks.filter(t => t.id !== id);
  });
}

export function tasksOfProject(projectId) {
  return state.db?.tasks.filter(t => t.projectId === projectId) || [];
}

export function tasksOfPhase(projectId, phaseId) {
  return state.db?.tasks.filter(t => t.projectId === projectId && t.phaseId === phaseId) || [];
}

export function getTask(id) {
  return state.db?.tasks.find(t => t.id === id) || null;
}

// ─── TIMER + TIME LOGS ───────────────────────────────
// Timer state is session-only (not persisted). Each stop creates a TimeLog
// which does persist in db.timeLogs.
let pomodoroTimeout = null;

export function startTimer(taskId) {
  // Stop any running timer first (and log it).
  if (state.timer) stopTimer();
  const pomodoroEnabled = state.db?.settings?.pomodoroEnabled;
  const focusMin = state.db?.settings?.pomodoroFocusMinutes || 25;
  state.timer = {
    taskId,
    startedAt: Date.now(),
    pomodoro: pomodoroEnabled,
    focusMinutes: pomodoroEnabled ? focusMin : null
  };
  if (pomodoroEnabled) {
    clearTimeout(pomodoroTimeout);
    pomodoroTimeout = setTimeout(() => {
      if (state.timer && state.timer.taskId === taskId) {
        stopTimer();
        pingBreak();
      }
    }, focusMin * 60 * 1000);
  }
  emit();
}

function pingBreak() {
  // Simple notification + beep.
  try {
    if ('Notification' in window && Notification.permission === 'granted') {
      new Notification('Pomodoro complete', { body: 'Take a short break.', icon: '/icon.svg' });
    }
  } catch {}
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.connect(g); g.connect(ctx.destination);
    o.frequency.value = 660;
    g.gain.setValueAtTime(0.15, ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.4);
    o.start();
    o.stop(ctx.currentTime + 0.4);
  } catch {}
}

export function stopTimer() {
  if (!state.timer) return null;
  clearTimeout(pomodoroTimeout);
  const { taskId, startedAt } = state.timer;
  const endedAt = Date.now();
  const durationSec = Math.round((endedAt - startedAt) / 1000);
  state.timer = null;
  if (durationSec < 10) {
    // Discard tiny accidental timers (<10s).
    emit();
    return null;
  }
  const id = uid('tl');
  mutate(db => {
    db.timeLogs.push({
      id,
      taskId,
      startedAt,
      endedAt,
      durationSec,
      notes: ''
    });
    // Update task's cached actualMinutes for quick render.
    const t = db.tasks.find(t => t.id === taskId);
    if (t) {
      t.actualMinutes = (t.actualMinutes || 0) + Math.round(durationSec / 60);
      t.updatedAt = Date.now();
    }
  });
  return id;
}

export function cancelTimer() {
  clearTimeout(pomodoroTimeout);
  state.timer = null;
  emit();
}

export function addManualTimeLog(taskId, minutes, when) {
  if (!minutes || minutes <= 0) return;
  const endedAt = when || Date.now();
  const id = uid('tl');
  mutate(db => {
    db.timeLogs.push({
      id,
      taskId,
      startedAt: endedAt - minutes * 60000,
      endedAt,
      durationSec: minutes * 60,
      notes: 'manual'
    });
    const t = db.tasks.find(t => t.id === taskId);
    if (t) {
      t.actualMinutes = (t.actualMinutes || 0) + minutes;
      t.updatedAt = Date.now();
    }
  });
}

export function updateTimeLog(id, patch) {
  mutate(db => {
    const log = db.timeLogs.find(l => l.id === id);
    if (!log) return;
    const oldDurationSec = log.durationSec || 0;
    Object.assign(log, patch);
    // Recompute endedAt if duration changed and startedAt is kept.
    if (patch.durationSec != null && !patch.endedAt) {
      log.endedAt = log.startedAt + patch.durationSec * 1000;
    }
    const t = db.tasks.find(t => t.id === log.taskId);
    if (t) {
      const diffMin = Math.round(((log.durationSec || 0) - oldDurationSec) / 60);
      t.actualMinutes = Math.max(0, (t.actualMinutes || 0) + diffMin);
      t.updatedAt = Date.now();
    }
  });
}

export function deleteTimeLog(id) {
  mutate(db => {
    const log = db.timeLogs.find(l => l.id === id);
    if (!log) return;
    const minutes = Math.round((log.durationSec || 0) / 60);
    db.timeLogs = db.timeLogs.filter(l => l.id !== id);
    const t = db.tasks.find(t => t.id === log.taskId);
    if (t) {
      t.actualMinutes = Math.max(0, (t.actualMinutes || 0) - minutes);
      t.updatedAt = Date.now();
    }
  });
}

export function logsInRange(startMs, endMs) {
  if (!state.db?.timeLogs) return [];
  return state.db.timeLogs.filter(l => l.endedAt >= startMs && l.endedAt < endMs);
}

export function logsOfDay(dayStart) {
  const dayEnd = dayStart + 86400000;
  return logsInRange(dayStart, dayEnd);
}

export function allTasks() {
  return state.db?.tasks || [];
}

// Sum of time logs for a given task, in minutes.
export function actualMinutesForTask(taskId) {
  const t = getTask(taskId);
  if (t?.actualMinutes != null) return t.actualMinutes;
  // Fallback: compute from logs (migration path).
  const logs = state.db?.timeLogs?.filter(l => l.taskId === taskId) || [];
  return Math.round(logs.reduce((a, l) => a + (l.durationSec || 0), 0) / 60);
}

// Minutes logged today (across all tasks).
export function minutesLoggedToday() {
  if (!state.db?.timeLogs) return 0;
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const startMs = start.getTime();
  let sec = 0;
  for (const l of state.db.timeLogs) {
    if (l.endedAt && l.endedAt >= startMs) sec += (l.durationSec || 0);
  }
  // Also count current running timer towards today's total.
  if (state.timer && state.timer.startedAt >= startMs) {
    sec += Math.round((Date.now() - state.timer.startedAt) / 1000);
  }
  return Math.round(sec / 60);
}

// ─── progress helpers ────────────────────────────────
export function projectProgress(projectId) {
  const tasks = tasksOfProject(projectId);
  if (tasks.length === 0) return { done: 0, total: 0, pct: 0 };
  const done = tasks.filter(t => t.done).length;
  return { done, total: tasks.length, pct: Math.round((done / tasks.length) * 100) };
}

export function phaseProgress(projectId, phaseId) {
  const tasks = tasksOfPhase(projectId, phaseId);
  if (tasks.length === 0) return { done: 0, total: 0, pct: 0 };
  const done = tasks.filter(t => t.done).length;
  return { done, total: tasks.length, pct: Math.round((done / tasks.length) * 100) };
}

export function clientProgress(clientId) {
  const projects = projectsOfClient(clientId);
  if (projects.length === 0) return { done: 0, total: 0, pct: 0 };
  let done = 0, total = 0;
  for (const p of projects) {
    const pp = projectProgress(p.id);
    done += pp.done;
    total += pp.total;
  }
  return { done, total, pct: total ? Math.round((done / total) * 100) : 0 };
}
