// Sites view — all sites across clients, with up/down + SSL status.
// Server-side ping via /api/ping; results persisted into the main DB.

import * as store from '../store.js';
import * as api from '../api.js';
import { h, formatRelative } from '../ui.js';

const inFlight = new Set();  // site ids currently being pinged

async function syncMonitorList() {
  try {
    await api.putMonitorSites(store.monitoredSitesList());
  } catch (e) {
    console.warn('Monitor sync failed', e);
  }
}
export { syncMonitorList };

export function render() {
  const db = store.state.db;
  const sites = store.allSites();
  const grouped = groupByClient(sites, db);

  return `
    <div class="sites-view">
      <div class="section-hdr" style="margin-bottom:16px">
        <div>
          <div class="pv-title" style="font-size:24px;margin-bottom:4px">🌐 Sites</div>
          <div class="pv-meta" style="margin-bottom:0">${sites.length} total · ${sites.filter(s => s.up === true).length} up · ${sites.filter(s => s.up === false).length} down</div>
        </div>
        <div style="display:flex;gap:8px">
          ${sites.length > 0 ? `<button class="btn-ghost btn-sm" data-action="check-all">↻ Check all</button>` : ''}
          ${sites.some(s => s.monitored) ? `<button class="btn-ghost btn-sm" data-action="run-cron-now">⏰ Run cron now</button>` : ''}
        </div>
      </div>

      ${sites.length === 0
        ? `<div class="empty-section">
            <div class="empty-ico">🌐</div>
            <div class="empty-t">No sites being monitored</div>
            <div class="empty-s">Open any client → Sites tab → add their production URL. The app pings them on open and flags down sites or near-expiry SSL on Today.</div>
          </div>`
        : grouped.map(g => `
            <div class="sites-group">
              <div class="sites-group-h">
                <a href="#" data-action="open-client" data-id="${g.client.id}">${h(g.client.name)}</a>
                <span class="sites-group-count">${g.sites.length}</span>
              </div>
              <div class="site-list">
                ${g.sites.map(s => siteRow(s)).join('')}
              </div>
            </div>
          `).join('')}
    </div>
  `;
}

function groupByClient(sites, db) {
  const byClient = new Map();
  for (const s of sites) {
    const list = byClient.get(s.clientId) || [];
    list.push(s);
    byClient.set(s.clientId, list);
  }
  const out = [];
  for (const [clientId, siteList] of byClient) {
    const client = db.clients.find(c => c.id === clientId);
    if (client) out.push({ client, sites: siteList });
  }
  out.sort((a, b) => a.client.name.localeCompare(b.client.name));
  return out;
}

export function siteRow(s) {
  const checking = inFlight.has(s.id);
  const upDot = checking ? 'checking' : s.up === true ? 'up' : s.up === false ? 'down' : 'unknown';
  const upText = checking ? 'checking…' : s.up === true ? 'Up' : s.up === false ? 'Down' : 'Not checked';
  return `
    <div class="site-row">
      <div class="site-status">
        <span class="site-dot ${upDot}"></span>
        <span class="site-status-label">${h(upText)}</span>
      </div>
      <div class="site-main">
        <div class="site-url">
          <a href="${h(s.url)}" target="_blank" rel="noopener noreferrer">${h(stripScheme(s.url))}</a>
          ${s.label ? `<span class="site-label">${h(s.label)}</span>` : ''}
          ${s.monitored ? '<span class="site-mon-badge" title="Monitored hourly by the Vercel cron">⏰ bg</span>' : ''}
        </div>
        <div class="site-meta">
          ${s.statusCode ? `<span>${s.statusCode}</span>` : ''}
          ${s.latencyMs != null ? `<span>${s.latencyMs}ms</span>` : ''}
          ${s.sslDaysLeft != null ? `<span class="${sslClass(s.sslDaysLeft)}">🔒 SSL ${s.sslDaysLeft}d</span>` : ''}
          ${s.wpVersion ? `<span>WP ${h(s.wpVersion)}</span>` : s.isWordPress ? '<span>WP</span>' : ''}
          ${s.error ? `<span class="site-err">${h(s.error)}</span>` : ''}
          ${s.checkedAt ? `<span class="site-when">${h(formatRelative(s.checkedAt))}</span>` : ''}
        </div>
      </div>
      <div class="site-acts">
        <button class="file-btn ${s.monitored ? 'site-btn-mon' : ''}" data-action="toggle-monitor" data-id="${s.id}" title="${s.monitored ? 'Turn off background monitoring' : 'Monitor hourly in the background'}">${s.monitored ? '⏰' : '🕐'}</button>
        <button class="file-btn" data-action="check-site" data-id="${s.id}" title="Re-check">↻</button>
        <button class="file-btn" data-action="edit-site" data-id="${s.id}" title="Edit">✎</button>
        <button class="file-btn danger" data-action="delete-site" data-id="${s.id}" title="Delete">×</button>
      </div>
    </div>
  `;
}

function stripScheme(url) {
  return (url || '').replace(/^https?:\/\//, '').replace(/\/$/, '');
}

function sslClass(days) {
  if (days < 0) return 'site-ssl-expired';
  if (days <= 14) return 'site-ssl-soon';
  return '';
}

async function checkSite(id) {
  const s = store.getSite(id);
  if (!s || inFlight.has(id)) return;
  inFlight.add(id);
  store.uiMutate(() => {});
  try {
    const result = await api.pingSite(s.url);
    store.updateSite(id, {
      checkedAt: result.checkedAt,
      up: result.up,
      statusCode: result.statusCode,
      latencyMs: result.latencyMs,
      sslDaysLeft: result.sslDaysLeft,
      sslExpires: result.sslExpires,
      sslIssuer: result.sslIssuer,
      isWordPress: result.isWordPress,
      wpVersion: result.wpVersion,
      error: result.error
    });
  } catch (e) {
    store.updateSite(id, {
      checkedAt: Date.now(),
      up: false,
      error: e.message
    });
  } finally {
    inFlight.delete(id);
    store.uiMutate(() => {});
  }
}

async function checkAll(ids) {
  await Promise.all(ids.map(id => checkSite(id)));
}

export function autoCheckStale(ids, staleAgeMs = 60 * 60 * 1000) {
  const now = Date.now();
  const stale = ids.filter(id => {
    const s = store.getSite(id);
    return s && (!s.checkedAt || (now - s.checkedAt) > staleAgeMs);
  });
  if (stale.length) checkAll(stale);
}

export function wireEvents(root) {
  // On mount, trigger a background re-check of any stale sites (older than 1 hour).
  autoCheckStale(store.allSites().map(s => s.id));

  root.addEventListener('click', (e) => {
    const el = e.target.closest('[data-action]');
    if (!el) return;
    const a = el.dataset.action;
    if (a === 'check-site') {
      checkSite(el.dataset.id);
    } else if (a === 'check-all') {
      checkAll(store.allSites().map(s => s.id));
    } else if (a === 'edit-site') {
      store.uiMutate(ui => { ui.modal = { kind: 'edit-site', siteId: el.dataset.id }; });
    } else if (a === 'delete-site') {
      if (confirm('Delete this site from monitoring?')) store.deleteSite(el.dataset.id);
    } else if (a === 'open-client') {
      e.preventDefault();
      store.uiMutate(ui => { ui.view = 'client'; ui.clientId = el.dataset.id; ui.clientTab = 'sites'; });
    } else if (a === 'toggle-monitor') {
      store.toggleSiteMonitored(el.dataset.id);
      syncMonitorList();
    } else if (a === 'run-cron-now') {
      runCronNow();
    }
  });
}

async function runCronNow() {
  try {
    const r = await api.triggerCronNow();
    const res = await api.fetchMonitorResults();
    store.mergeMonitorResults(res.results || []);
  } catch (e) {
    alert('Background check failed: ' + (e.message || e));
  }
}
