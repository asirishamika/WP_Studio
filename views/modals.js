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
    case 'add-log':                return logFormModal(null, m.when);
    case 'edit-log':               return logFormModal(store.state.db.timeLogs.find(l => l.id === m.logId), null);
    case 'new-renewal':            return renewalFormModal(null, m.clientId);
    case 'edit-renewal':           return renewalFormModal(findRenewal(m.clientId, m.renewalId), m.clientId);
    case 'add-maint-entry':        return maintEntryFormModal(null, m.clientId);
    case 'edit-maint-entry':       return maintEntryFormModal(findMaintEntry(m.clientId, m.entryId), m.clientId);
    default: return '';
  }
}

function findRenewal(clientId, id) {
  const c = store.getClient(clientId);
  return c?.renewals?.find(r => r.id === id) || null;
}
function findMaintEntry(clientId, id) {
  const c = store.getClient(clientId);
  return c?.maintenanceEntries?.find(e => e.id === id) || null;
}

function renewalFormModal(existing, clientId) {
  const isEdit = !!existing;
  const r = existing || { kind: 'domain', provider: '', item: '', expiresAt: '', cost: '', autoRenew: false, url: '', notes: '' };
  return wrap(`
    <div class="modal" data-stop>
      <div class="m-hdr">
        <div class="m-title">${isEdit ? 'Edit renewal' : 'Add renewal'}</div>
        <div class="m-x" data-action="close-modal">×</div>
      </div>
      <div class="m-body">
        <div class="frow2">
          <div class="field">
            <label>Kind</label>
            <select id="f-kind">
              <option value="domain"  ${r.kind === 'domain'  ? 'selected' : ''}>🌐 Domain</option>
              <option value="hosting" ${r.kind === 'hosting' ? 'selected' : ''}>🖥️ Hosting</option>
              <option value="ssl"     ${r.kind === 'ssl'     ? 'selected' : ''}>🔒 SSL</option>
              <option value="plugin"  ${r.kind === 'plugin'  ? 'selected' : ''}>🧩 Plugin / licence</option>
              <option value="other"   ${r.kind === 'other'   ? 'selected' : ''}>📦 Other</option>
            </select>
          </div>
          <div class="field"><label>Expires on *</label><input id="f-expires" type="date" value="${h(r.expiresAt)}"></div>
        </div>
        <div class="frow2">
          <div class="field"><label>Item</label><input id="f-item" value="${h(r.item)}" placeholder="example.com, Hostinger renewal, WP Rocket licence…"></div>
          <div class="field"><label>Provider</label><input id="f-provider" value="${h(r.provider)}" placeholder="Namecheap, Hostinger, GoDaddy…"></div>
        </div>
        <div class="frow2">
          <div class="field"><label>Cost (optional)</label><input id="f-cost" value="${h(r.cost)}" placeholder="$14/year"></div>
          <div class="field"><label>Auto-renew?</label>
            <label class="switch" style="margin-top:4px">
              <input type="checkbox" id="f-autorenew" ${r.autoRenew ? 'checked' : ''}>
              <span class="switch-slider"></span>
            </label>
          </div>
        </div>
        <div class="field"><label>Management URL (optional)</label><input id="f-url" value="${h(r.url)}" placeholder="https://hpanel.hostinger.com/…"></div>
        <div class="field"><label>Notes</label><textarea id="f-notes" placeholder="Any specifics the client should know…">${h(r.notes || '')}</textarea></div>
      </div>
      <div class="m-foot">
        <button class="btn-ghost" data-action="close-modal">Cancel</button>
        <button class="btn-primary" data-action="save-renewal" ${isEdit ? `data-id="${r.id}" data-client="${clientId}"` : `data-client="${clientId}"`}>${isEdit ? 'Save' : 'Add renewal'}</button>
      </div>
    </div>
  `);
}

function maintEntryFormModal(existing, clientId) {
  const isEdit = !!existing;
  const e = existing || { date: new Date().toISOString().slice(0, 10), task: '', notes: '', hoursSpent: '', sent: false };
  return wrap(`
    <div class="modal" data-stop>
      <div class="m-hdr">
        <div class="m-title">${isEdit ? 'Edit maintenance entry' : 'Log maintenance work'}</div>
        <div class="m-x" data-action="close-modal">×</div>
      </div>
      <div class="m-body">
        <div class="frow2">
          <div class="field"><label>Date *</label><input id="f-date" type="date" value="${h(e.date)}"></div>
          <div class="field"><label>Hours spent (optional)</label><input id="f-hours" value="${h(e.hoursSpent || '')}" placeholder="e.g. 0.5"></div>
        </div>
        <div class="field"><label>Task *</label><input id="f-task" value="${h(e.task)}" placeholder="e.g. Monthly updates & backup check"></div>
        <div class="field"><label>Notes (shown on the client's report)</label><textarea id="f-notes" placeholder="Updated WP core, 12 plugins, scanned for malware (clean), tested backup restore…">${h(e.notes || '')}</textarea></div>
        <div class="field" style="flex-direction:row;align-items:center;gap:10px">
          <label class="switch">
            <input type="checkbox" id="f-sent" ${e.sent ? 'checked' : ''}>
            <span class="switch-slider"></span>
          </label>
          <div><div class="settings-row-l">Already sent to client</div><div class="settings-row-s">Mark if you've already shared this specific entry.</div></div>
        </div>
      </div>
      <div class="m-foot">
        <button class="btn-ghost" data-action="close-modal">Cancel</button>
        <button class="btn-primary" data-action="save-maint-entry" ${isEdit ? `data-id="${e.id}" data-client="${clientId}"` : `data-client="${clientId}"`}>${isEdit ? 'Save' : 'Log it'}</button>
      </div>
    </div>
  `);
}

function logFormModal(existing, when) {
  const isEdit = !!existing;
  const task = isEdit ? store.getTask(existing.taskId) : null;
  const endedAt = isEdit ? existing.endedAt : (when || Date.now());
  const durationMin = isEdit ? Math.round((existing.durationSec || 0) / 60) : 30;
  const dateStr = new Date(endedAt).toISOString().slice(0, 10);
  const timeStr = new Date(endedAt).toTimeString().slice(0, 5);
  const allTasks = store.allTasks();
  const taskOptions = allTasks.map(t => {
    const p = store.getProject(t.projectId);
    const c = p ? store.getClient(p.clientId) : null;
    const label = `${c?.name || '?'} · ${p?.name || '?'} · ${t.title}`;
    return `<option value="${t.id}" ${isEdit && t.id === existing.taskId ? 'selected' : ''}>${h(label)}</option>`;
  }).join('');

  return wrap(`
    <div class="modal" data-stop>
      <div class="m-hdr">
        <div class="m-title">${isEdit ? 'Edit log entry' : 'Add log entry'}</div>
        <div class="m-x" data-action="close-modal">×</div>
      </div>
      <div class="m-body">
        <div class="field">
          <label>Task</label>
          <select id="f-task">
            ${isEdit ? '' : `<option value="">— pick a task —</option>`}
            ${taskOptions}
          </select>
        </div>
        <div class="frow3">
          <div class="field"><label>Date</label><input id="f-date" type="date" value="${dateStr}"></div>
          <div class="field"><label>End time</label><input id="f-time" type="time" value="${timeStr}"></div>
          <div class="field"><label>Duration (minutes)</label><input id="f-duration" type="number" min="1" max="1440" value="${durationMin}"></div>
        </div>
        <div class="field"><label>Notes (optional)</label><input id="f-notes" value="${h(existing?.notes || '')}" placeholder="What you worked on…"></div>
      </div>
      <div class="m-foot">
        <button class="btn-ghost" data-action="close-modal">Cancel</button>
        <button class="btn-primary" data-action="save-log" ${isEdit ? `data-id="${existing.id}"` : ''}>${isEdit ? 'Save' : 'Add log'}</button>
      </div>
    </div>
  `);
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
        <div class="field" style="flex-direction:row;align-items:center;gap:10px">
          <label class="switch">
            <input type="checkbox" id="f-hasMaintenance" ${c.hasMaintenance ? 'checked' : ''}>
            <span class="switch-slider"></span>
          </label>
          <div><div class="settings-row-l">On a maintenance plan</div><div class="settings-row-s">Adds a Maintenance tab for logging ongoing work and exporting client-ready reports.</div></div>
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
        name:            root.querySelector('#f-name').value.trim(),
        niche:           root.querySelector('#f-niche').value.trim(),
        contactName:     root.querySelector('#f-contactName').value.trim(),
        contactEmail:    root.querySelector('#f-contactEmail').value.trim(),
        notes:           root.querySelector('#f-notes').value,
        avatarIndex:     selectedAvatar,
        hasMaintenance:  root.querySelector('#f-hasMaintenance').checked
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
    } else if (a === 'save-renewal') {
      const data = {
        kind:       root.querySelector('#f-kind').value,
        item:       root.querySelector('#f-item').value.trim(),
        provider:   root.querySelector('#f-provider').value.trim(),
        expiresAt:  root.querySelector('#f-expires').value,
        cost:       root.querySelector('#f-cost').value.trim(),
        autoRenew:  root.querySelector('#f-autorenew').checked,
        url:        root.querySelector('#f-url').value.trim(),
        notes:      root.querySelector('#f-notes').value
      };
      if (!data.expiresAt) { root.querySelector('#f-expires').focus(); return; }
      const clientId = el.dataset.client;
      if (el.dataset.id) {
        store.updateRenewal(clientId, el.dataset.id, data);
      } else {
        store.addRenewal(clientId, data);
      }
      store.uiMutate(ui => { ui.modal = null; });
    } else if (a === 'save-maint-entry') {
      const data = {
        date:        root.querySelector('#f-date').value,
        task:        root.querySelector('#f-task').value.trim(),
        notes:       root.querySelector('#f-notes').value,
        hoursSpent:  root.querySelector('#f-hours').value.trim(),
        sent:        root.querySelector('#f-sent').checked
      };
      if (!data.task) { root.querySelector('#f-task').focus(); return; }
      const clientId = el.dataset.client;
      if (el.dataset.id) {
        store.updateMaintenanceEntry(clientId, el.dataset.id, data);
      } else {
        store.addMaintenanceEntry(clientId, data);
      }
      store.uiMutate(ui => { ui.modal = null; });
    } else if (a === 'save-log') {
      const taskId = root.querySelector('#f-task').value;
      const date = root.querySelector('#f-date').value;
      const time = root.querySelector('#f-time').value;
      const minutes = parseInt(root.querySelector('#f-duration').value, 10) || 0;
      const notes = root.querySelector('#f-notes').value;
      if (!taskId) { root.querySelector('#f-task').focus(); return; }
      if (!minutes || minutes <= 0) { root.querySelector('#f-duration').focus(); return; }
      const endedAt = date && time ? new Date(`${date}T${time}`).getTime() : Date.now();
      if (el.dataset.id) {
        store.updateTimeLog(el.dataset.id, {
          taskId,
          endedAt,
          startedAt: endedAt - minutes * 60000,
          durationSec: minutes * 60,
          notes
        });
      } else {
        store.addManualTimeLog(taskId, minutes, endedAt);
        if (notes) {
          // Attach notes to the just-added log.
          const logs = store.state.db.timeLogs;
          const latest = logs[logs.length - 1];
          if (latest) store.updateTimeLog(latest.id, { notes });
        }
      }
      store.uiMutate(ui => { ui.modal = null; });
    }
  });

  // Escape to close
  const esc = (ev) => { if (ev.key === 'Escape') { store.uiMutate(ui => { ui.modal = null; }); document.removeEventListener('keydown', esc); } };
  document.addEventListener('keydown', esc);
}
