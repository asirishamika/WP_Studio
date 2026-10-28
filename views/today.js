// Today view — the home screen you open every morning.
// Shows active projects, overdue tasks, next up, and quick stats.

import * as store from '../store.js';
import { h, formatRelative, taskLink, projectLink, clientLink } from '../ui.js';

export function render() {
  const db = store.state.db;
  const activeProjects = db.projects.filter(p => p.status === 'active');
  const openTasks = db.tasks.filter(t => !t.done);
  const todaysOverdue = openTasks.filter(t => t.dueDate && new Date(t.dueDate) <= new Date());
  const highPriority = openTasks.filter(t => t.priority === 'high').slice(0, 10);
  const completedToday = db.tasks.filter(t => {
    if (!t.doneAt) return false;
    const d = new Date(t.doneAt);
    const today = new Date();
    return d.toDateString() === today.toDateString();
  });

  const greeting = greet();

  return `
    <div class="today">
      <div class="today-hdr">
        <div>
          <div class="today-greet">${greeting}</div>
          <div class="today-sub">${db.clients.length} ${db.clients.length === 1 ? 'client' : 'clients'} · ${activeProjects.length} active ${activeProjects.length === 1 ? 'project' : 'projects'} · ${openTasks.length} open ${openTasks.length === 1 ? 'task' : 'tasks'}</div>
        </div>
      </div>

      <div class="today-grid">
        <div class="today-col">
          ${siteAlertsBlock()}

          <div class="today-section">
            <div class="today-section-h">High priority</div>
            ${highPriority.length === 0
              ? `<div class="today-empty">Nothing high-priority open. Breathe. ☕</div>`
              : highPriority.map(t => taskRow(t)).join('')}
          </div>

          ${todaysOverdue.length > 0 ? `
            <div class="today-section">
              <div class="today-section-h today-section-warn">Overdue</div>
              ${todaysOverdue.map(t => taskRow(t)).join('')}
            </div>` : ''}
        </div>

        <div class="today-col today-col-sm">
          <div class="today-stat-grid">
            <div class="today-stat">
              <div class="today-stat-n">${db.clients.length}</div>
              <div class="today-stat-l">Clients</div>
            </div>
            <div class="today-stat">
              <div class="today-stat-n">${activeProjects.length}</div>
              <div class="today-stat-l">Active projects</div>
            </div>
            <div class="today-stat">
              <div class="today-stat-n">${completedToday.length}</div>
              <div class="today-stat-l">Done today</div>
            </div>
            <div class="today-stat">
              <div class="today-stat-n">${fmtMinsShort(store.minutesLoggedToday())}</div>
              <div class="today-stat-l">Logged today</div>
            </div>
          </div>

          <div class="today-section">
            <div class="today-section-h">Active projects</div>
            ${activeProjects.length === 0
              ? `<div class="today-empty">No active projects yet.</div>`
              : activeProjects.map(p => projectCard(p)).join('')}
          </div>
        </div>
      </div>
    </div>
  `;
}

function taskRow(t) {
  const project = store.getProject(t.projectId);
  const client = project ? store.getClient(project.clientId) : null;
  return `
    <div class="t-row" data-action="open-task" data-project="${t.projectId}">
      <button class="t-check ${t.done ? 'done' : ''}" data-action="toggle-task" data-id="${t.id}"></button>
      <div class="t-row-body">
        <div class="t-row-title ${t.done ? 'struck' : ''}">${h(t.title)}</div>
        <div class="t-row-meta">
          ${client ? `<span>${h(client.name)}</span>` : ''}
          ${project ? `<span>${h(project.name)}</span>` : ''}
          ${t.dueDate ? `<span class="t-row-due">${formatRelative(t.dueDate)}</span>` : ''}
        </div>
      </div>
      <button class="t-row-timer" data-action="start-timer-row" data-id="${t.id}" title="Start timer">▶</button>
      <span class="t-pri p-${t.priority[0]}">${t.priority}</span>
    </div>
  `;
}

function projectCard(p) {
  const client = store.getClient(p.clientId);
  const prog = store.projectProgress(p.id);
  return `
    <a href="#" class="today-proj" data-action="open-project" data-id="${p.id}">
      <div class="today-proj-meta">
        <div class="today-proj-name">${h(p.name)}</div>
        <div class="today-proj-client">${client ? h(client.name) : ''}</div>
      </div>
      <div class="today-proj-r">
        <div class="today-proj-pct">${prog.pct}%</div>
        <div class="today-proj-bar"><div class="today-proj-bar-f" style="width:${prog.pct}%"></div></div>
      </div>
    </a>
  `;
}

function siteAlertsBlock() {
  const alerts = store.siteAlerts();
  const down = alerts.down;
  const sslSoon = alerts.sslSoon;
  const sslExpired = alerts.sslExpired;
  if (down.length === 0 && sslSoon.length === 0 && sslExpired.length === 0) return '';
  return `
    <div class="today-section today-alerts">
      <div class="today-section-h today-section-warn">⚠ Site alerts</div>
      ${down.map(s => `
        <div class="today-alert" data-action="open-sites">
          <span class="site-dot down"></span>
          <span class="today-alert-label"><strong>${h(stripScheme(s.url))}</strong> is down</span>
        </div>
      `).join('')}
      ${sslExpired.map(s => `
        <div class="today-alert" data-action="open-sites">
          <span class="today-alert-icon">🔒</span>
          <span class="today-alert-label">SSL expired for <strong>${h(stripScheme(s.url))}</strong></span>
        </div>
      `).join('')}
      ${sslSoon.map(s => `
        <div class="today-alert" data-action="open-sites">
          <span class="today-alert-icon">🔒</span>
          <span class="today-alert-label">SSL for <strong>${h(stripScheme(s.url))}</strong> expires in ${s.sslDaysLeft}d</span>
        </div>
      `).join('')}
    </div>
  `;
}

function stripScheme(url) {
  return (url || '').replace(/^https?:\/\//, '').replace(/\/$/, '');
}

function fmtMinsShort(m) {
  if (!m) return '0h';
  if (m < 60) return m + 'm';
  const h = Math.floor(m / 60);
  const rem = m % 60;
  return rem ? `${h}h${rem}m` : `${h}h`;
}

function greet() {
  const hr = new Date().getHours();
  if (hr < 5)  return 'Still up?';
  if (hr < 12) return 'Good morning';
  if (hr < 17) return 'Good afternoon';
  if (hr < 22) return 'Good evening';
  return 'Late night.';
}

export function wireEvents(root) {
  root.addEventListener('click', (e) => {
    const el = e.target.closest('[data-action]');
    if (!el) return;
    const action = el.dataset.action;
    if (action === 'toggle-task') {
      e.stopPropagation();
      store.toggleTask(el.dataset.id);
    } else if (action === 'open-project') {
      e.preventDefault();
      store.uiMutate(ui => { ui.view = 'project'; ui.projectId = el.dataset.id; });
    } else if (action === 'open-task') {
      // row clicks (non-checkbox) jump to the project
      store.uiMutate(ui => { ui.view = 'project'; ui.projectId = el.dataset.project; });
    } else if (action === 'start-timer-row') {
      e.stopPropagation();
      store.startTimer(el.dataset.id);
    } else if (action === 'open-sites') {
      store.uiMutate(ui => { ui.view = 'sites'; });
    }
  });
}
