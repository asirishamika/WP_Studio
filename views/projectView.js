// Project detail view — phases with collapsible task lists.

import * as store from '../store.js';
import { h, formatDate } from '../ui.js';
import { STATUSES, PRIORITIES } from '../data.js';

const openPhases = new Set();

export function render() {
  const project = store.getProject(store.state.ui.projectId);
  if (!project) {
    return `<div class="placeholder"><h2>Project not found</h2></div>`;
  }
  const client = store.getClient(project.clientId);
  const prog = store.projectProgress(project.id);
  const status = STATUSES[project.status] || STATUSES.active;

  // If no phase is open, auto-open the first non-complete phase.
  if (openPhases.size === 0 && project.phases.length > 0) {
    const firstIncomplete = project.phases.find(ph => store.phaseProgress(project.id, ph.id).pct < 100);
    openPhases.add((firstIncomplete || project.phases[0]).id);
  }

  return `
    <div class="project-view">
      <div class="pv-hdr">
        <div class="pv-crumbs">
          <a href="#" data-action="open-client" data-id="${client ? client.id : ''}">${client ? h(client.name) : 'Client'}</a>
          <span>/</span>
          <span>${h(project.name)}</span>
        </div>
        <div class="pv-acts">
          <select class="pv-status s-pill ${status.cls}" data-action="change-status">
            ${Object.entries(STATUSES).map(([k, v]) =>
              `<option value="${k}" ${k === project.status ? 'selected' : ''}>${v.label}</option>`
            ).join('')}
          </select>
          <button class="tb-btn" data-action="edit-project">Edit</button>
          <button class="tb-btn danger" data-action="delete-project">Delete</button>
        </div>
      </div>

      <div class="pv-main">
        <div class="pv-title">${h(project.name)}</div>
        <div class="pv-meta">
          ${project.deadline ? `<span>Due ${formatDate(project.deadline)}</span>` : ''}
          ${project.budget ? `<span>Budget $${h(project.budget)}</span>` : ''}
          ${project.url ? `<span><a href="${h(project.url)}" target="_blank" rel="noopener noreferrer">${h(project.url)}</a></span>` : ''}
        </div>
        <div class="pv-progress">
          <div class="pv-progress-bar"><div class="pv-progress-fill" style="width:${prog.pct}%"></div></div>
          <div class="pv-progress-pct">${prog.done} / ${prog.total} · ${prog.pct}%</div>
        </div>
      </div>

      ${project.phases.length === 0 ? emptyPhases() : `
        <div class="phases-wrap">
          ${project.phases.map(ph => phaseBlock(project, ph)).join('')}
        </div>
        <button class="btn-primary btn-sm" data-action="add-phase" style="margin-top:16px">+ Add Phase</button>
      `}
    </div>
  `;
}

function emptyPhases() {
  return `
    <div class="empty-section">
      <div class="empty-ico">🧱</div>
      <div class="empty-t">No phases yet</div>
      <div class="empty-s">This project was created without a template. Add a phase to start tracking tasks.</div>
      <button class="btn-primary" data-action="add-phase">Add first phase</button>
    </div>
  `;
}

function phaseBlock(project, phase) {
  const tasks = store.tasksOfPhase(project.id, phase.id);
  const prog = store.phaseProgress(project.id, phase.id);
  const isOpen = openPhases.has(phase.id);
  return `
    <div class="ph-block ${isOpen ? 'open' : ''}">
      <div class="ph-hdr" data-action="toggle-phase" data-id="${phase.id}">
        <div class="ph-ic" style="background:var(--${phase.color}-bg,var(--bg3));border-color:var(--${phase.color}-br,var(--bdr));color:var(--${phase.color},var(--ink))">${phase.icon || '•'}</div>
        <div class="ph-meta">
          <div class="ph-title">${h(phase.label)}</div>
          <div class="ph-sub">${prog.done} of ${prog.total} tasks complete</div>
        </div>
        <div class="ph-right">
          <div class="ph-pct">${prog.pct}%</div>
          <div class="ph-mbar"><div class="ph-mfill" style="width:${prog.pct}%;background:var(--${phase.color},var(--ink))"></div></div>
          <div class="ph-chev">›</div>
        </div>
      </div>
      <div class="ph-tasks">
        <div class="ph-div"></div>
        ${tasks.map(t => taskItem(t)).join('')}
        <button class="btn-ghost btn-sm" data-action="add-task" data-phase="${phase.id}" style="margin-top:10px;width:auto;padding:6px 14px">+ Add task to ${h(phase.label)}</button>
      </div>
    </div>
  `;
}

function taskItem(t) {
  const pri = PRIORITIES[t.priority] || PRIORITIES.medium;
  const actual = store.actualMinutesForTask(t.id);
  const est = t.estimateMinutes || 0;
  const isTiming = store.state.timer && store.state.timer.taskId === t.id;
  return `
    <div class="task-item" data-task-id="${t.id}">
      <button class="t-check ${t.done ? 'done' : ''}" data-action="toggle-task" data-id="${t.id}"></button>
      <div class="t-body">
        <div class="t-title ${t.done ? 'struck' : ''}" data-action="edit-task-title" data-id="${t.id}">${h(t.title)}</div>
        ${t.hint ? `<div class="t-hint">${h(t.hint)}</div>` : ''}
        <div class="t-time">
          <span class="t-time-pill" data-action="edit-estimate" data-id="${t.id}" title="Click to set estimate">
            est ${est ? fmtMins(est) : '—'}
          </span>
          <span class="t-time-pill ${actual > est && est > 0 ? 'over' : ''}" title="Logged time">
            actual ${actual ? fmtMins(actual) : '—'}
          </span>
          <button class="t-timer-btn ${isTiming ? 'running' : ''}" data-action="${isTiming ? 'stop-task-timer' : 'start-task-timer'}" data-id="${t.id}">
            ${isTiming ? '⏹ Stop' : '▶ Start'}
          </button>
        </div>
      </div>
      <span class="t-pri ${pri.cls}">${pri.label}</span>
      <button class="t-del" data-action="delete-task" data-id="${t.id}" title="Delete task">×</button>
    </div>
  `;
}

function fmtMins(m) {
  if (m < 60) return m + 'm';
  const h = Math.floor(m / 60);
  const rem = m % 60;
  return rem ? `${h}h${rem}m` : `${h}h`;
}

export function wireEvents(root) {
  root.addEventListener('click', (e) => {
    const el = e.target.closest('[data-action]');
    if (!el) return;
    const a = el.dataset.action;
    if (a === 'toggle-task') {
      e.stopPropagation();
      store.toggleTask(el.dataset.id);
    } else if (a === 'toggle-phase') {
      const id = el.dataset.id;
      if (openPhases.has(id)) openPhases.delete(id);
      else openPhases.add(id);
      store.uiMutate(() => {}); // trigger re-render
    } else if (a === 'open-client') {
      e.preventDefault();
      store.uiMutate(ui => { ui.view = 'client'; ui.clientId = el.dataset.id; });
    } else if (a === 'add-task') {
      e.stopPropagation();
      const title = prompt('Task title:');
      if (title && title.trim()) {
        store.addTask({
          projectId: store.state.ui.projectId,
          phaseId: el.dataset.phase,
          title: title.trim(),
          priority: 'medium'
        });
      }
    } else if (a === 'add-phase') {
      const label = prompt('Phase name (e.g. "Launch & Handoff"):');
      if (label && label.trim()) {
        store.updateProject(store.state.ui.projectId, {
          phases: [
            ...store.getProject(store.state.ui.projectId).phases,
            { id: store.uid('ph'), label: label.trim(), icon: '•', color: 'indigo' }
          ]
        });
      }
    } else if (a === 'delete-task') {
      e.stopPropagation();
      if (confirm('Delete this task?')) store.deleteTask(el.dataset.id);
    } else if (a === 'edit-task-title') {
      const task = store.state.db.tasks.find(t => t.id === el.dataset.id);
      const newTitle = prompt('Edit task title:', task.title);
      if (newTitle && newTitle.trim() && newTitle !== task.title) {
        store.updateTask(el.dataset.id, { title: newTitle.trim() });
      }
    } else if (a === 'edit-project') {
      store.uiMutate(ui => { ui.modal = { kind: 'edit-project', projectId: store.state.ui.projectId }; });
    } else if (a === 'delete-project') {
      store.uiMutate(ui => { ui.modal = { kind: 'confirm-delete-project', projectId: store.state.ui.projectId }; });
    } else if (a === 'start-task-timer') {
      store.startTimer(el.dataset.id);
    } else if (a === 'stop-task-timer') {
      store.stopTimer();
    } else if (a === 'edit-estimate') {
      e.stopPropagation();
      const task = store.getTask(el.dataset.id);
      const current = task.estimateMinutes || '';
      const raw = prompt('Estimate for this task (e.g. "45m", "2h", "1h30m"):', fmtEstimateInput(current));
      if (raw === null) return;
      const mins = parseEstimate(raw);
      store.updateTask(el.dataset.id, { estimateMinutes: mins });
    }
  });

  function fmtEstimateInput(m) {
    if (!m) return '';
    const h = Math.floor(m / 60), rem = m % 60;
    if (h && rem) return `${h}h${rem}m`;
    if (h) return `${h}h`;
    return `${rem}m`;
  }
  function parseEstimate(s) {
    if (!s) return null;
    s = String(s).trim().toLowerCase().replace(/\s+/g, '');
    if (!s) return null;
    let total = 0;
    const hMatch = s.match(/(\d+)\s*h/);
    const mMatch = s.match(/(\d+)\s*m/);
    if (hMatch) total += parseInt(hMatch[1], 10) * 60;
    if (mMatch) total += parseInt(mMatch[1], 10);
    if (!hMatch && !mMatch) {
      const n = parseInt(s, 10);
      if (!isNaN(n)) total = n; // bare number = minutes
    }
    return total > 0 ? total : null;
  }

  root.addEventListener('change', (e) => {
    const el = e.target.closest('[data-action="change-status"]');
    if (!el) return;
    store.updateProject(store.state.ui.projectId, { status: el.value });
  });
}
