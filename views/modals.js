// Modals: new/edit client, new/edit project, confirm deletes.

import * as store from '../store.js';
import { h } from '../ui.js';
import { AVATAR_COLORS, STATUSES, STATUS_ORDER } from '../data.js';

export function render() {
  const m = store.state.ui.modal;
  if (!m) return '';
  switch (m.kind) {
    case 'new-client':             return clientFormModal(null);
    case 'edit-client':            return clientFormModal(store.getClient(m.clientId));
    case 'new-project':            return projectFormModal(null, m.clientId);
    case 'edit-project':           return projectFormModal(store.getProject(m.projectId), null);
    case 'confirm-delete-client':  return confirmDeleteClient(m.clientId);
    case 'confirm-delete-project': return confirmDeleteProject(m.projectId);
    case 'new-site':               return siteFormModal(null, m.clientId);
    case 'edit-site':              return siteFormModal(store.getSite(m.siteId), null);
    default: return '';
  }
}

function siteFormModal(existing, prefillClientId) {
  const isEdit = !!existing;
  const s = existing || { url: '', label: '' };
  const clientId = isEdit ? existing.clientId : prefillClientId;
  return wrap(`
    <div class="modal" data-stop>
      <div class="m-hdr">
        <div class="m-title">${isEdit ? 'Edit site' : 'Add site'}</div>
        <div class="m-x" data-action="close-modal">×</div>
      </div>
      <div class="m-body">
        <div class="field"><label>URL *</label><input id="f-url" value="${h(s.url)}" placeholder="https://example.com" autocomplete="off"></div>
        <div class="field"><label>Label (optional)</label><input id="f-label" value="${h(s.label)}" placeholder="Production, Staging…"></div>
      </div>
      <div class="m-foot">
        <button class="btn-ghost" data-action="close-modal">Cancel</button>
        <button class="btn-primary" data-action="save-site" ${isEdit ? `data-id="${s.id}"` : `data-client="${clientId}"`}>${isEdit ? 'Save changes' : 'Add site'}</button>
      </div>
    </div>
  `);
}

function wrap(inner) {
  return `<div class="ov show" data-action="close-modal-bg">${inner}</div>`;
}

function clientFormModal(existing) {
  const isEdit = !!existing;
  const c = existing || { name: '', niche: '', contactName: '', contactEmail: '', avatarIndex: 0, notes: '' };
  return wrap(`
    <div class="modal" data-stop>
      <div class="m-hdr">
        <div class="m-title">${isEdit ? 'Edit client' : 'New client'}</div>
        <div class="m-x" data-action="close-modal">×</div>
      </div>
      <div class="m-body">
        <div class="frow2">
          <div class="field"><label>Business / Client name *</label><input id="f-name" value="${h(c.name)}" placeholder="e.g. Sunrise Dental"></div>
          <div class="field"><label>Industry / Niche</label><input id="f-niche" value="${h(c.niche)}" placeholder="Dental clinic"></div>
        </div>
        <div class="frow2">
          <div class="field"><label>Contact person</label><input id="f-contactName" value="${h(c.contactName)}" placeholder="Dr. Sarah Ahmed"></div>
          <div class="field"><label>Contact email</label><input id="f-contactEmail" type="email" value="${h(c.contactEmail)}" placeholder="sarah@clinic.com"></div>
        </div>
        <div class="field">
          <label>Avatar colour</label>
          <div class="c-row">
            ${AVATAR_COLORS.map((col, i) => `
              <div class="csw ${i === (c.avatarIndex ?? 0) ? 'sel' : ''}" data-action="pick-avatar" data-idx="${i}" style="background:${col.bg}"></div>
            `).join('')}
          </div>
        </div>
        <div class="field"><label>Notes</label><textarea id="f-notes" placeholder="Anything useful about this client…">${h(c.notes || '')}</textarea></div>
      </div>
      <div class="m-foot">
        <button class="btn-ghost" data-action="close-modal">Cancel</button>
        <button class="btn-primary" data-action="save-client" ${isEdit ? `data-id="${c.id}"` : ''}>${isEdit ? 'Save changes' : 'Create client'}</button>
      </div>
    </div>
  `);
}

function projectFormModal(existing, prefillClientId) {
  const isEdit = !!existing;
  const p = existing || {
    name: '', status: 'active', budget: '', startDate: '', deadline: '', url: '', templateId: 'wp_build', notes: ''
  };
  const templates = store.state.db.templates;
  const clientId = isEdit ? existing.clientId : prefillClientId;

  return wrap(`
    <div class="modal" data-stop>
      <div class="m-hdr">
        <div class="m-title">${isEdit ? 'Edit project' : 'New project'}</div>
        <div class="m-x" data-action="close-modal">×</div>
      </div>
      <div class="m-body">
        <div class="field"><label>Project name *</label><input id="f-name" value="${h(p.name)}" placeholder="e.g. Website Rebuild"></div>
        ${isEdit ? '' : `
          <div class="field">
            <label>Template</label>
            <select id="f-template">
              <option value="">— No template (blank) —</option>
              ${templates.map(t => `<option value="${t.id}" ${t.id === p.templateId ? 'selected' : ''}>${h(t.name)} (${t.phases.reduce((a, ph) => a + ph.tasks.length, 0)} tasks)</option>`).join('')}
            </select>
          </div>
        `}
        <div class="frow3">
          <div class="field">
            <label>Status</label>
            <select id="f-status">
              ${STATUS_ORDER.map(k => `<option value="${k}" ${k === p.status ? 'selected' : ''}>${STATUSES[k].label}</option>`).join('')}
            </select>
          </div>
          <div class="field"><label>Budget</label><input id="f-budget" value="${h(p.budget)}" placeholder="1,200"></div>
          <div class="field"><label>Deadline</label><input id="f-deadline" type="date" value="${h(p.deadline)}"></div>
        </div>
        <div class="field"><label>Website URL</label><input id="f-url" value="${h(p.url)}" placeholder="https://example.com"></div>
      </div>
      <div class="m-foot">
        <button class="btn-ghost" data-action="close-modal">Cancel</button>
        <button class="btn-primary" data-action="save-project" ${isEdit ? `data-id="${p.id}"` : `data-client="${clientId}"`}>${isEdit ? 'Save changes' : 'Create project'}</button>
      </div>
    </div>
  `);
}

function confirmDeleteClient(id) {
  const c = store.getClient(id);
  const projCount = store.projectsOfClient(id).length;
  return wrap(`
    <div class="conf-box" data-stop>
      <div class="conf-ico">🗑️</div>
      <div class="conf-t">Delete ${h(c?.name || 'client')}?</div>
      <div class="conf-s">This will permanently delete the client, all ${projCount} ${projCount === 1 ? 'project' : 'projects'}, and all their tasks. This cannot be undone.</div>
      <div class="conf-acts">
        <button class="btn-ghost" data-action="close-modal">Cancel</button>
        <button class="btn-del" data-action="confirm-delete-client" data-id="${id}">Delete</button>
      </div>
    </div>
  `);
}

function confirmDeleteProject(id) {
  const p = store.getProject(id);
  const taskCount = store.tasksOfProject(id).length;
  return wrap(`
    <div class="conf-box" data-stop>
      <div class="conf-ico">🗑️</div>
      <div class="conf-t">Delete ${h(p?.name || 'project')}?</div>
      <div class="conf-s">All ${taskCount} ${taskCount === 1 ? 'task' : 'tasks'} will be deleted with it. The client stays.</div>
      <div class="conf-acts">
        <button class="btn-ghost" data-action="close-modal">Cancel</button>
        <button class="btn-del" data-action="confirm-delete-project" data-id="${id}">Delete</button>
      </div>
    </div>
  `);
}

let selectedAvatar = 0;

export function wireEvents(root) {
  const modal = store.state.ui.modal;
  if (!modal) return;
  if (modal.kind === 'edit-client') {
    const c = store.getClient(modal.clientId);
    selectedAvatar = c?.avatarIndex ?? 0;
  } else if (modal.kind === 'new-client') {
    selectedAvatar = Math.floor(Math.random() * AVATAR_COLORS.length);
    const sel = root.querySelectorAll('.csw');
    sel.forEach((e, i) => e.classList.toggle('sel', i === selectedAvatar));
  }

  root.addEventListener('click', (e) => {
    const bg = e.target.closest('[data-action="close-modal-bg"]');
    const stop = e.target.closest('[data-stop]');
    if (bg && !stop) {
      store.uiMutate(ui => { ui.modal = null; });
      return;
    }

    const el = e.target.closest('[data-action]');
    if (!el) return;
    const a = el.dataset.action;

    if (a === 'close-modal') {
      store.uiMutate(ui => { ui.modal = null; });
    } else if (a === 'pick-avatar') {
      selectedAvatar = parseInt(el.dataset.idx, 10);
      root.querySelectorAll('.csw').forEach((e, i) => e.classList.toggle('sel', i === selectedAvatar));
    } else if (a === 'save-client') {
      const data = {
        name:         root.querySelector('#f-name').value.trim(),
        niche:        root.querySelector('#f-niche').value.trim(),
        contactName:  root.querySelector('#f-contactName').value.trim(),
        contactEmail: root.querySelector('#f-contactEmail').value.trim(),
        notes:        root.querySelector('#f-notes').value,
        avatarIndex:  selectedAvatar
      };
      if (!data.name) { root.querySelector('#f-name').focus(); return; }
      if (el.dataset.id) {
        store.updateClient(el.dataset.id, data);
      } else {
        const id = store.addClient(data);
        store.uiMutate(ui => { ui.view = 'client'; ui.clientId = id; });
      }
      store.uiMutate(ui => { ui.modal = null; });
    } else if (a === 'save-project') {
      const name = root.querySelector('#f-name').value.trim();
      if (!name) { root.querySelector('#f-name').focus(); return; }
      const data = {
        name,
        status:    root.querySelector('#f-status').value,
        budget:    root.querySelector('#f-budget').value.trim(),
        deadline:  root.querySelector('#f-deadline').value,
        url:       root.querySelector('#f-url').value.trim()
      };
      if (el.dataset.id) {
        store.updateProject(el.dataset.id, data);
      } else {
        const templateSel = root.querySelector('#f-template');
        data.templateId = templateSel.value || null;
        data.clientId = el.dataset.client;
        const id = store.addProject(data);
        store.uiMutate(ui => { ui.view = 'project'; ui.projectId = id; });
      }
      store.uiMutate(ui => { ui.modal = null; });
    } else if (a === 'confirm-delete-client') {
      const id = el.dataset.id;
      store.deleteClient(id);
      store.uiMutate(ui => { ui.modal = null; ui.view = 'today'; ui.clientId = null; });
    } else if (a === 'confirm-delete-project') {
      const id = el.dataset.id;
      const projectClient = store.getProject(id)?.clientId;
      store.deleteProject(id);
      store.uiMutate(ui => { ui.modal = null; ui.view = projectClient ? 'client' : 'today'; ui.projectId = null; ui.clientId = projectClient; });
    } else if (a === 'save-site') {
      const url = root.querySelector('#f-url').value.trim();
      const label = root.querySelector('#f-label').value.trim();
      if (!url) { root.querySelector('#f-url').focus(); return; }
      if (el.dataset.id) {
        store.updateSite(el.dataset.id, { url, label });
      } else {
        store.addSite({ url, label, clientId: el.dataset.client });
      }
      store.uiMutate(ui => { ui.modal = null; });
    }
  });

  // Escape to close
  const esc = (ev) => { if (ev.key === 'Escape') { store.uiMutate(ui => { ui.modal = null; }); document.removeEventListener('keydown', esc); } };
  document.addEventListener('keydown', esc);
}
