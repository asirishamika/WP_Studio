// Command palette (Ctrl+K / Cmd+K).
// Jump to any client/project, create a client, toggle Today.

import * as store from '../store.js';
import { h } from '../ui.js';

export function render() {
  if (!store.state.ui.paletteOpen) return '';
  return `
    <div class="pal-ov show" data-action="close-palette-bg">
      <div class="pal" data-stop>
        <div class="pal-inp-wrap">
          <input id="pal-input" class="pal-inp" placeholder="Jump to anything…" autocomplete="off">
        </div>
        <div class="pal-list" id="pal-list"></div>
        <div class="pal-foot"><span>↑↓ navigate · ↵ open · esc close</span></div>
      </div>
    </div>
  `;
}

let selected = 0;
let items = [];

function buildItems(q) {
  const db = store.state.db;
  const query = q.trim().toLowerCase();
  const base = [];

  // Nav items
  base.push({ kind: 'nav', label: '🏠 Today', action: () => store.uiMutate(ui => { ui.view = 'today'; }) });
  base.push({ kind: 'nav', label: '📊 Time reports', action: () => store.uiMutate(ui => { ui.view = 'time'; }) });
  base.push({ kind: 'nav', label: '🌐 Sites', action: () => store.uiMutate(ui => { ui.view = 'sites'; }) });
  base.push({ kind: 'nav', label: '⚙ Settings', action: () => store.uiMutate(ui => { ui.view = 'settings'; }) });
  base.push({ kind: 'nav', label: '➕ New client', action: () => store.uiMutate(ui => { ui.modal = { kind: 'new-client' }; }) });

  // Clients
  for (const c of db.clients) {
    base.push({
      kind: 'client',
      label: `👤 ${c.name}`,
      hint: c.niche || '',
      action: () => store.uiMutate(ui => { ui.view = 'client'; ui.clientId = c.id; })
    });
  }

  // Projects
  for (const p of db.projects) {
    const client = db.clients.find(c => c.id === p.clientId);
    base.push({
      kind: 'project',
      label: `📋 ${p.name}`,
      hint: client ? client.name : '',
      action: () => store.uiMutate(ui => { ui.view = 'project'; ui.projectId = p.id; })
    });
  }

  if (!query) return base.slice(0, 20);
  return base.filter(i =>
    i.label.toLowerCase().includes(query) ||
    (i.hint && i.hint.toLowerCase().includes(query))
  ).slice(0, 20);
}

function renderList(q) {
  items = buildItems(q);
  if (selected >= items.length) selected = Math.max(0, items.length - 1);
  const list = document.getElementById('pal-list');
  if (!list) return;
  if (items.length === 0) {
    list.innerHTML = `<div class="pal-empty">Nothing matches "${h(q)}"</div>`;
    return;
  }
  list.innerHTML = items.map((it, i) => `
    <div class="pal-item ${i === selected ? 'sel' : ''}" data-idx="${i}">
      <div class="pal-item-label">${h(it.label)}</div>
      ${it.hint ? `<div class="pal-item-hint">${h(it.hint)}</div>` : ''}
    </div>
  `).join('');
}

export function wireEvents(root) {
  const input = document.getElementById('pal-input');
  if (!input) return;
  selected = 0;
  renderList('');
  requestAnimationFrame(() => input.focus());

  input.addEventListener('input', () => {
    selected = 0;
    renderList(input.value);
  });

  input.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); selected = Math.min(items.length - 1, selected + 1); renderList(input.value); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); selected = Math.max(0, selected - 1); renderList(input.value); }
    else if (e.key === 'Enter') {
      e.preventDefault();
      if (items[selected]) { items[selected].action(); close(); }
    }
    else if (e.key === 'Escape') { e.preventDefault(); close(); }
  });

  root.addEventListener('click', (e) => {
    const bg = e.target.closest('[data-action="close-palette-bg"]');
    const stop = e.target.closest('[data-stop]');
    if (bg && !stop) { close(); return; }
    const item = e.target.closest('[data-idx]');
    if (item) {
      selected = parseInt(item.dataset.idx, 10);
      if (items[selected]) { items[selected].action(); close(); }
    }
  });
}

function close() {
  store.uiMutate(ui => { ui.paletteOpen = false; });
}

export function open() {
  store.uiMutate(ui => { ui.paletteOpen = true; });
}
