// Tiny UI helpers shared by views.

export function h(s) {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function formatDate(d) {
  if (!d) return '';
  const dt = new Date(d);
  if (isNaN(dt)) return '';
  return dt.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

export function formatTime(d) {
  if (!d) return '';
  const dt = new Date(d);
  if (isNaN(dt)) return '';
  return dt.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
}

export function formatRelative(d) {
  if (!d) return '';
  const dt = new Date(d).getTime();
  const now = Date.now();
  const diff = dt - now;
  const abs = Math.abs(diff);
  const DAY = 86400000;
  if (abs < DAY) return diff < 0 ? 'today' : 'today';
  const days = Math.round(diff / DAY);
  if (days === 1) return 'tomorrow';
  if (days === -1) return 'yesterday';
  if (days < 0) return `${-days}d ago`;
  if (days < 7) return `in ${days}d`;
  return formatDate(d);
}

export function clientLink(c) {
  return `data-action="open-client" data-id="${c.id}"`;
}
export function projectLink(p) {
  return `data-action="open-project" data-id="${p.id}"`;
}
export function taskLink(t) {
  return `data-action="toggle-task" data-id="${t.id}"`;
}

export function avatarStyle(client, palette) {
  const c = palette[client.avatarIndex ?? 0] || palette[0];
  return `background:${c.bg};color:${c.fg}`;
}

export function initials(name) {
  if (!name) return '?';
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}
