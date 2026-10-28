// Time Reports — week view with daily totals, per-client breakdown,
// drill into a day to see/edit/delete log entries, add manual logs.

import * as store from '../store.js';
import { h, formatDate } from '../ui.js';

// Local view state (session-only).
const vs = {
  weekStart: null,     // Date at Monday 00:00 of the viewed week
  selectedDay: null,   // ms timestamp of selected day
};

function startOfWeek(d) {
  const dt = new Date(d);
  dt.setHours(0, 0, 0, 0);
  const dow = dt.getDay(); // 0=Sun
  const diff = (dow + 6) % 7; // days since Monday
  dt.setDate(dt.getDate() - diff);
  return dt;
}

function fmtDur(mins) {
  if (!mins) return '0m';
  if (mins < 60) return mins + 'm';
  const h = Math.floor(mins / 60), r = mins % 60;
  return r ? `${h}h${r}m` : `${h}h`;
}

export function render() {
  if (!vs.weekStart) vs.weekStart = startOfWeek(new Date());

  const weekStart = vs.weekStart.getTime();
  const weekEnd = weekStart + 7 * 86400000;
  const logs = store.logsInRange(weekStart, weekEnd);

  // Daily buckets.
  const days = [];
  for (let i = 0; i < 7; i++) {
    const dayStart = weekStart + i * 86400000;
    const dayLogs = logs.filter(l => l.endedAt >= dayStart && l.endedAt < dayStart + 86400000);
    const minutes = Math.round(dayLogs.reduce((a, l) => a + (l.durationSec || 0), 0) / 60);
    days.push({ dayStart, minutes, count: dayLogs.length });
  }
  const weekTotalMin = days.reduce((a, d) => a + d.minutes, 0);

  if (!vs.selectedDay) {
    // Default: today if in week, else last day with logs, else Monday.
    const todayStart = startOfWeek(new Date()).getTime() + ((new Date().getDay() + 6) % 7) * 86400000;
    if (todayStart >= weekStart && todayStart < weekEnd) {
      vs.selectedDay = todayStart;
    } else {
      const lastWithLogs = [...days].reverse().find(d => d.count > 0);
      vs.selectedDay = lastWithLogs ? lastWithLogs.dayStart : weekStart;
    }
  }

  // Per-client/project breakdown for the week.
  const breakdown = buildBreakdown(logs);

  // Selected day's logs.
  const dayLogs = logs
    .filter(l => l.endedAt >= vs.selectedDay && l.endedAt < vs.selectedDay + 86400000)
    .sort((a, b) => a.startedAt - b.startedAt);

  return `
    <div class="reports-view">
      <div class="pv-hdr">
        <div class="pv-crumbs"><span>Time</span></div>
        <div class="pv-acts">
          <button class="btn-ghost btn-sm" data-action="prev-week">← Prev</button>
          <button class="btn-ghost btn-sm" data-action="this-week">This week</button>
          <button class="btn-ghost btn-sm" data-action="next-week">Next →</button>
          <button class="btn-primary btn-sm" data-action="export-week">⇩ Export</button>
        </div>
      </div>

      <div class="pv-main" style="margin-bottom:16px">
        <div class="pv-title" style="font-size:24px">${weekLabel(vs.weekStart)}</div>
        <div class="pv-meta"><span>${fmtDur(weekTotalMin)} logged this week</span></div>
      </div>

      <div class="week-grid">
        ${days.map(d => dayCell(d)).join('')}
      </div>

      <div class="reports-grid">
        <div>
          <div class="section-hdr"><div class="section-title">${new Date(vs.selectedDay).toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })}</div>
            <button class="btn-primary btn-sm" data-action="add-log">+ Add log</button>
          </div>
          ${dayLogs.length === 0
            ? `<div class="empty-section"><div class="empty-ico">⌛</div><div class="empty-t">No time logged on this day</div><div class="empty-s">Click "+ Add log" if you worked but forgot the timer.</div></div>`
            : `<div class="log-list">${dayLogs.map(l => logRow(l)).join('')}</div>`}
        </div>

        <div>
          <div class="section-hdr"><div class="section-title">By client</div></div>
          ${breakdown.byClient.length === 0
            ? `<div class="today-empty">Nothing logged this week.</div>`
            : `<div class="breakdown-list">${breakdown.byClient.map(b => breakdownRow(b, weekTotalMin)).join('')}</div>`}

          <div class="section-hdr" style="margin-top:16px"><div class="section-title">By project</div></div>
          ${breakdown.byProject.length === 0
            ? `<div class="today-empty">—</div>`
            : `<div class="breakdown-list">${breakdown.byProject.slice(0, 10).map(b => breakdownRow(b, weekTotalMin)).join('')}</div>`}
        </div>
      </div>
    </div>
  `;
}

function dayCell(d) {
  const dt = new Date(d.dayStart);
  const isSelected = d.dayStart === vs.selectedDay;
  const dayName = dt.toLocaleDateString(undefined, { weekday: 'short' });
  const isToday = isSameDay(dt, new Date());
  return `
    <button class="week-day ${isSelected ? 'sel' : ''} ${isToday ? 'today' : ''}" data-action="pick-day" data-day="${d.dayStart}">
      <div class="week-day-h">${dayName}</div>
      <div class="week-day-n">${dt.getDate()}</div>
      <div class="week-day-min">${d.minutes ? fmtDur(d.minutes) : '—'}</div>
    </button>
  `;
}

function isSameDay(a, b) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

function logRow(l) {
  const task = store.getTask(l.taskId);
  const project = task ? store.getProject(task.projectId) : null;
  const client = project ? store.getClient(project.clientId) : null;
  const start = new Date(l.startedAt).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
  const mins = Math.round((l.durationSec || 0) / 60);
  return `
    <div class="log-row">
      <div class="log-time">${start}</div>
      <div class="log-main">
        <div class="log-title">${h(task?.title || 'Deleted task')}</div>
        <div class="log-sub">${client ? h(client.name) : ''}${project ? ' · ' + h(project.name) : ''}${l.notes ? ' · ' + h(l.notes) : ''}</div>
      </div>
      <div class="log-dur">${fmtDur(mins)}</div>
      <div class="log-acts">
        <button class="file-btn" data-action="edit-log" data-id="${l.id}" title="Edit">✎</button>
        <button class="file-btn danger" data-action="delete-log" data-id="${l.id}" title="Delete">×</button>
      </div>
    </div>
  `;
}

function buildBreakdown(logs) {
  const byClient = new Map();
  const byProject = new Map();
  for (const l of logs) {
    const task = store.getTask(l.taskId);
    if (!task) continue;
    const project = store.getProject(task.projectId);
    if (!project) continue;
    const client = store.getClient(project.clientId);
    const min = Math.round((l.durationSec || 0) / 60);
    if (client) byClient.set(client.id, (byClient.get(client.id) || 0) + min);
    byProject.set(project.id, (byProject.get(project.id) || 0) + min);
  }
  const toList = (map, lookupName) =>
    [...map.entries()]
      .map(([id, min]) => ({ id, label: lookupName(id), min }))
      .sort((a, b) => b.min - a.min);
  return {
    byClient: toList(byClient, (id) => store.getClient(id)?.name || 'Unknown'),
    byProject: toList(byProject, (id) => store.getProject(id)?.name || 'Unknown')
  };
}

function breakdownRow(b, totalMin) {
  const pct = totalMin ? Math.round((b.min / totalMin) * 100) : 0;
  return `
    <div class="breakdown-row">
      <div class="breakdown-label">${h(b.label)}</div>
      <div class="breakdown-bar"><div class="breakdown-fill" style="width:${pct}%"></div></div>
      <div class="breakdown-val">${fmtDur(b.min)}</div>
    </div>
  `;
}

function weekLabel(start) {
  const end = new Date(start.getTime() + 6 * 86400000);
  const sameMonth = start.getMonth() === end.getMonth();
  const startStr = start.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  const endStr = end.toLocaleDateString(undefined, {
    month: sameMonth ? undefined : 'short',
    day: 'numeric',
    year: 'numeric'
  });
  return `${startStr} – ${endStr}`;
}

function exportWeekText() {
  const weekStart = vs.weekStart.getTime();
  const logs = store.logsInRange(weekStart, weekStart + 7 * 86400000);
  const lines = [`Time log — week of ${weekLabel(vs.weekStart)}`, ''];
  const byDay = new Map();
  for (const l of logs) {
    const dayKey = startOfWeek(new Date(l.endedAt)).getTime() + ((new Date(l.endedAt).getDay() + 6) % 7) * 86400000;
    const day = new Date(l.endedAt);
    day.setHours(0, 0, 0, 0);
    const key = day.getTime();
    if (!byDay.has(key)) byDay.set(key, []);
    byDay.get(key).push(l);
  }
  const sortedDays = [...byDay.keys()].sort();
  let total = 0;
  for (const key of sortedDays) {
    const dayLogs = byDay.get(key).sort((a, b) => a.startedAt - b.startedAt);
    const dayMin = Math.round(dayLogs.reduce((a, l) => a + (l.durationSec || 0), 0) / 60);
    total += dayMin;
    lines.push(new Date(key).toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' }) + `  —  ${fmtDur(dayMin)}`);
    for (const l of dayLogs) {
      const task = store.getTask(l.taskId);
      const project = task ? store.getProject(task.projectId) : null;
      const client = project ? store.getClient(project.clientId) : null;
      const mins = Math.round((l.durationSec || 0) / 60);
      const t = new Date(l.startedAt).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
      lines.push(`  ${t}  ${fmtDur(mins).padStart(6)}  ${client?.name || ''} · ${project?.name || ''} · ${task?.title || '[deleted]'}`);
    }
    lines.push('');
  }
  lines.push(`Total: ${fmtDur(total)}`);
  const blob = new Blob([lines.join('\n')], { type: 'text/plain' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `time-log-${vs.weekStart.toISOString().slice(0, 10)}.txt`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1500);
}

export function wireEvents(root) {
  root.addEventListener('click', (e) => {
    const el = e.target.closest('[data-action]');
    if (!el) return;
    const a = el.dataset.action;
    if (a === 'prev-week') {
      vs.weekStart = new Date(vs.weekStart.getTime() - 7 * 86400000);
      vs.selectedDay = null;
      store.uiMutate(() => {});
    } else if (a === 'next-week') {
      vs.weekStart = new Date(vs.weekStart.getTime() + 7 * 86400000);
      vs.selectedDay = null;
      store.uiMutate(() => {});
    } else if (a === 'this-week') {
      vs.weekStart = startOfWeek(new Date());
      vs.selectedDay = null;
      store.uiMutate(() => {});
    } else if (a === 'pick-day') {
      vs.selectedDay = parseInt(el.dataset.day, 10);
      store.uiMutate(() => {});
    } else if (a === 'edit-log') {
      store.uiMutate(ui => { ui.modal = { kind: 'edit-log', logId: el.dataset.id }; });
    } else if (a === 'delete-log') {
      if (confirm('Delete this log entry?')) store.deleteTimeLog(el.dataset.id);
    } else if (a === 'add-log') {
      store.uiMutate(ui => { ui.modal = { kind: 'add-log', when: vs.selectedDay }; });
    } else if (a === 'export-week') {
      exportWeekText();
    }
  });
}
