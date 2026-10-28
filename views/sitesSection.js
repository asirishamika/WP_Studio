// Per-client Sites tab — renewals + monitored sites.

import * as store from '../store.js';
import { siteRow, wireEvents as wireSitesView } from './sitesView.js';
import * as renewals from './renewalsSection.js';

export function render() {
  const clientId = store.state.ui.clientId;
  const sites = store.sitesOfClient(clientId);
  return `
    <div class="sites-section">
      ${renewals.render(clientId)}

      <div class="section-hdr" style="margin-top:22px">
        <div class="section-title">Monitored sites (${sites.length})</div>
        <button class="btn-primary btn-sm" data-action="new-site">+ Add site</button>
      </div>
      ${sites.length === 0
        ? `<div class="empty-section">
            <div class="empty-ico">🌐</div>
            <div class="empty-t">No sites yet</div>
            <div class="empty-s">Add your client's production URL to track uptime and SSL expiry.</div>
            <button class="btn-primary" data-action="new-site">Add first site</button>
          </div>`
        : `<div class="site-list">${sites.map(s => siteRow(s)).join('')}</div>`}
    </div>
  `;
}

export function wireEvents(root) {
  wireSitesView(root);
  renewals.wireEvents(root);
  root.addEventListener('click', (e) => {
    const el = e.target.closest('[data-action="new-site"]');
    if (el) {
      store.uiMutate(ui => { ui.modal = { kind: 'new-site', clientId: store.state.ui.clientId }; });
    }
  });
}
