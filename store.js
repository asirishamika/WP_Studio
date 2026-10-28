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
  ui: {
    view: 'today',          // 'today' | 'clients' | 'client' | 'project' | 'templates'
    clientId: null,
    projectId: null,
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
