// Scheduled cron — Vercel calls this on the schedule in vercel.json.
// Reads monitor/sites.json, pings each URL (HTTP + SSL + WP sniff),
// writes monitor/results.json. No access to the user's encrypted vault.
//
// Auth: accepts either the Vercel-signed cron Authorization header
// (Bearer CRON_SECRET) OR the normal WP_ACCESS_TOKEN so the user can
// manually trigger a run from the app.

import { put, head } from '@vercel/blob';
import { request as httpsRequest } from 'https';
import { request as httpRequest } from 'http';
import { connect as tlsConnect } from 'tls';

const SITES_KEY = 'monitor/sites.json';
const RESULTS_KEY = 'monitor/results.json';
const TIMEOUT_MS = 7000;
const MAX_BODY = 128 * 1024;
const MAX_SITES = 50;  // safety cap per run

function authorized(req) {
  const auth = req.headers['authorization'] || '';
  const token = req.headers['x-access-token'];
  const bearerExpected = process.env.CRON_SECRET && `Bearer ${process.env.CRON_SECRET}`;
  if (bearerExpected && auth === bearerExpected) return true;
  if (process.env.WP_ACCESS_TOKEN && token === process.env.WP_ACCESS_TOKEN) return true;
  return false;
}

function parseInputUrl(raw) {
  if (typeof raw !== 'string') return null;
  let u = raw.trim();
  if (!u) return null;
  if (!/^https?:\/\//i.test(u)) u = 'https://' + u;
  try {
    const parsed = new URL(u);
    if (!/^https?:$/.test(parsed.protocol)) return null;
    return parsed;
  } catch { return null; }
}

function httpCheck(parsedUrl) {
  return new Promise((resolve) => {
    const start = Date.now();
    const isHttps = parsedUrl.protocol === 'https:';
    const req = (isHttps ? httpsRequest : httpRequest)({
      hostname: parsedUrl.hostname,
      port: parsedUrl.port || (isHttps ? 443 : 80),
      path: (parsedUrl.pathname || '/') + (parsedUrl.search || ''),
      method: 'GET',
      headers: {
        'User-Agent': 'WPStudio-Monitor/1.0',
        'Accept': 'text/html,*/*;q=0.8'
      },
      timeout: TIMEOUT_MS
    }, (res) => {
      let body = '';
      let size = 0;
      res.on('data', (c) => { size += c.length; if (size <= MAX_BODY) body += c.toString('utf8'); });
      res.on('end', () => {
        resolve({
          up: res.statusCode < 500,
          statusCode: res.statusCode,
          latencyMs: Date.now() - start,
          headers: res.headers,
          body
        });
      });
      res.on('error', () => resolve({ up: false, statusCode: null, latencyMs: Date.now() - start, error: 'response_error' }));
    });
    req.on('timeout', () => { req.destroy(); resolve({ up: false, statusCode: null, latencyMs: TIMEOUT_MS, error: 'timeout' }); });
    req.on('error', (e) => resolve({ up: false, statusCode: null, latencyMs: Date.now() - start, error: e.code || e.message || 'network_error' }));
    req.end();
  });
}

function sslCheck(hostname) {
  return new Promise((resolve) => {
    const socket = tlsConnect({
      host: hostname, port: 443, servername: hostname,
      timeout: TIMEOUT_MS, rejectUnauthorized: false
    }, () => {
      const cert = socket.getPeerCertificate();
      try { socket.end(); } catch {}
      if (!cert || !cert.valid_to) return resolve({ sslDaysLeft: null, sslExpires: null });
      const expires = new Date(cert.valid_to);
      const daysLeft = Math.round((expires.getTime() - Date.now()) / 86400000);
      resolve({ sslDaysLeft: daysLeft, sslExpires: expires.toISOString() });
    });
    socket.on('error', () => resolve({ sslDaysLeft: null, sslExpires: null }));
    socket.on('timeout', () => { try { socket.destroy(); } catch {} resolve({ sslDaysLeft: null, sslExpires: null }); });
  });
}

function sniffWordPress(headers, body) {
  const powered = (headers['x-powered-by'] || '').toLowerCase();
  const linkHdr = headers.link || '';
  const genMatch = body && body.match(/<meta[^>]+name=["']generator["'][^>]+content=["']WordPress\s*([0-9.]+)/i);
  const version = genMatch ? genMatch[1] : null;
  const isWp = /wordpress/i.test(powered) || /api\.w\.org/i.test(linkHdr) || version !== null || /wp-content\//i.test(body || '') || /wp-includes\//i.test(body || '');
  return { isWordPress: isWp, wpVersion: version };
}

async function pingOne(site) {
  const parsed = parseInputUrl(site.url);
  if (!parsed) {
    return { id: site.id, url: site.url, checkedAt: Date.now(), up: false, error: 'bad_url' };
  }
  const [http, ssl] = await Promise.all([
    httpCheck(parsed),
    parsed.protocol === 'https:' ? sslCheck(parsed.hostname) : Promise.resolve({ sslDaysLeft: null, sslExpires: null })
  ]);
  const wp = sniffWordPress(http.headers || {}, http.body || '');
  return {
    id: site.id,
    url: site.url,
    checkedAt: Date.now(),
    up: !!http.up,
    statusCode: http.statusCode,
    latencyMs: http.latencyMs,
    sslDaysLeft: ssl.sslDaysLeft,
    sslExpires: ssl.sslExpires,
    isWordPress: wp.isWordPress,
    wpVersion: wp.wpVersion,
    error: http.error || null
  };
}

export default async function handler(req, res) {
  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    return res.status(500).json({ error: 'server_misconfigured_BLOB_READ_WRITE_TOKEN_missing' });
  }
  if (!authorized(req)) return res.status(401).json({ error: 'unauthorized' });

  const startedAt = Date.now();
  try {
    // Load the opt-in list.
    let sites = [];
    try {
      const info = await head(SITES_KEY);
      const url = info.downloadUrl || info.url;
      const r = await fetch(url, { cache: 'no-store' });
      const parsed = await r.json();
      sites = Array.isArray(parsed?.sites) ? parsed.sites.slice(0, MAX_SITES) : [];
    } catch (e) {
      const msg = (e && e.message) || '';
      if (!(e && (e.status === 404 || e.name === 'BlobNotFoundError' || /not found|does not exist/i.test(msg)))) throw e;
    }

    if (sites.length === 0) {
      await put(RESULTS_KEY, Buffer.from(JSON.stringify({ results: [], ranAt: startedAt, count: 0 }), 'utf8'), {
        access: 'public', addRandomSuffix: false, allowOverwrite: true,
        contentType: 'application/json'
      });
      return res.status(200).json({ ok: true, count: 0, ranAt: startedAt });
    }

    // Ping in parallel but cap concurrency to a sensible number.
    const results = [];
    const batchSize = 10;
    for (let i = 0; i < sites.length; i += batchSize) {
      const batch = sites.slice(i, i + batchSize);
      const batchResults = await Promise.all(batch.map(pingOne));
      results.push(...batchResults);
    }

    const payload = JSON.stringify({ results, ranAt: startedAt, count: results.length });
    await put(RESULTS_KEY, Buffer.from(payload, 'utf8'), {
      access: 'public', addRandomSuffix: false, allowOverwrite: true,
      contentType: 'application/json'
    });
    return res.status(200).json({ ok: true, count: results.length, ranAt: startedAt });
  } catch (e) {
    return res.status(500).json({ error: (e && e.message) || 'unknown' });
  }
}
