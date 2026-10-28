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
  if (db.templates.length === 0) {
    db.templates = JSON.parse(JSON.stringify(BUILTIN_TEMPLATES));
  }
  return db;
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
export function startTimer(taskId) {
  // Stop any running timer first (and log it).
  if (state.timer) stopTimer();
  state.timer = { taskId, startedAt: Date.now() };
  emit();
}

export function stopTimer() {
  if (!state.timer) return null;
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
  state.timer = null;
  emit();
}

export function addManualTimeLog(taskId, minutes) {
  if (!minutes || minutes <= 0) return;
  const now = Date.now();
  const id = uid('tl');
  mutate(db => {
    db.timeLogs.push({
      id,
      taskId,
      startedAt: now - minutes * 60000,
      endedAt: now,
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
