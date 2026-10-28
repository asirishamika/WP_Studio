// Client detail view — client info header + their projects list.

import * as store from '../store.js';
import { h, formatDate, initials, avatarStyle } from '../ui.js';
import { AVATAR_COLORS, STATUSES, STATUS_ORDER } from '../data.js';

export function render() {
  const client = store.getClient(store.state.ui.clientId);
  if (!client) {
    return `<div class="placeholder"><h2>Client not found</h2><p>It may have been deleted.</p></div>`;
  }
  const projects = store.projectsOfClient(client.id);
  const prog = store.clientProgress(client.id);

  return `
    <div class="client-view">
      <div class="ch">
        <div class="ch-av" style="${avatarStyle(client, AVATAR_COLORS)}">${initials(client.name)}</div>
        <div class="ch-body">
          <div class="ch-name">${h(client.name)}</div>
          <div class="ch-tags">
            ${client.niche ? `<span class="ch-tag">${h(client.niche)}</span>` : ''}
            ${client.contactName ? `<span class="ch-tag">👤 ${h(client.contactName)}</span>` : ''}
            ${client.contactEmail ? `<span class="ch-tag"><a href="mailto:${h(client.contactEmail)}">✉️ ${h(client.contactEmail)}</a></span>` : ''}
          </div>
          <textarea class="ch-notes" placeholder="Notes about this client…" data-action="save-client-notes">${h(client.notes || '')}</textarea>
        </div>
        <div class="ch-r">
          <div class="ch-pct">${prog.pct}%</div>
          <div class="ch-pct-l">Overall progress</div>
          <div class="ch-bar"><div class="ch-bar-f" style="width:${prog.pct}%;background:var(--ink)"></div></div>
          <div class="ch-acts">
            <button class="tb-btn" data-action="edit-client">Edit</button>
            <button class="tb-btn danger" data-action="delete-client">Delete</button>
          </div>
        </div>
      </div>

      <div class="section-hdr">
        <div class="section-title">Projects</div>
        <button class="btn-primary btn-sm" data-action="new-project">+ New Project</button>
      </div>

      ${projects.length === 0
        ? `<div class="empty-section">
            <div class="empty-ico">📋</div>
            <div class="empty-t">No projects yet</div>
            <div class="empty-s">Start a project to track phases and tasks for this client.</div>
            <button class="btn-primary" data-action="new-project">Create first project</button>
          </div>`
        : `<div class="proj-grid">${projects.map(p => projectCard(p)).join('')}</div>`}
    </div>
  `;
}

function projectCard(p) {
  const prog = store.projectProgress(p.id);
  const status = STATUSES[p.status] || STATUSES.active;
  return `
    <a href="#" class="proj-card" data-action="open-project" data-id="${p.id}">
      <div class="proj-card-top">
        <div class="proj-card-name">${h(p.name)}</div>
        <span class="s-pill ${status.cls}">${status.label}</span>
      </div>
      <div class="proj-card-meta">
        ${p.deadline ? `<span>Due ${formatDate(p.deadline)}</span>` : '<span>No deadline</span>'}
        ${p.budget ? `<span>$${h(p.budget)}</span>` : ''}
      </div>
      <div class="proj-card-foot">
        <div class="proj-card-bar"><div class="proj-card-bar-f" style="width:${prog.pct}%"></div></div>
        <div class="proj-card-pct">${prog.done}/${prog.total} · ${prog.pct}%</div>
      </div>
    </a>
  `;
}

let notesTimer = null;

export function wireEvents(root) {
  root.addEventListener('click', (e) => {
    const el = e.target.closest('[data-action]');
    if (!el) return;
    const a = el.dataset.action;
    if (a === 'open-project') {
      e.preventDefault();
      store.uiMutate(ui => { ui.view = 'project'; ui.projectId = el.dataset.id; });
    } else if (a === 'new-project') {
      store.uiMutate(ui => { ui.modal = { kind: 'new-project', clientId: store.state.ui.clientId }; });
    } else if (a === 'edit-client') {
      store.uiMutate(ui => { ui.modal = { kind: 'edit-client', clientId: store.state.ui.clientId }; });
    } else if (a === 'delete-client') {
      store.uiMutate(ui => { ui.modal = { kind: 'confirm-delete-client', clientId: store.state.ui.clientId }; });
    }
  });

  root.addEventListener('input', (e) => {
    const el = e.target.closest('[data-action="save-client-notes"]');
    if (!el) return;
    const val = el.value;
    clearTimeout(notesTimer);
    notesTimer = setTimeout(() => {
      store.updateClient(store.state.ui.clientId, { notes: val });
    }, 500);
  });
}
