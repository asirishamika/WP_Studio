// Server-side site check: HTTP status + latency + SSL days-left + WordPress version.
// POST { url } with x-access-token header → one result object.
// Avoids CORS limits of browser-side ping and gives real cert info.

import { request as httpsRequest } from 'https';
import { request as httpRequest } from 'http';
import { connect as tlsConnect } from 'tls';

const TIMEOUT_MS = 7000;
const MAX_BODY = 128 * 1024; // 128 KB response body cap for WP version sniff

function unauthorized(req) {
  const token = req.headers['x-access-token'];
  return !token || token !== process.env.WP_ACCESS_TOKEN;
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
        'User-Agent': 'WPStudio-Monitor/1.0 (+https://wpstudio-sandy.vercel.app)',
        'Accept': 'text/html,application/xhtml+xml,application/json;q=0.9,*/*;q=0.8'
      },
      timeout: TIMEOUT_MS
    }, (res) => {
      let body = '';
      let size = 0;
      res.on('data', (c) => {
        size += c.length;
        if (size <= MAX_BODY) body += c.toString('utf8');
      });
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
      host: hostname,
      port: 443,
      servername: hostname,
      timeout: TIMEOUT_MS,
      rejectUnauthorized: false
    }, () => {
      const cert = socket.getPeerCertificate();
      try { socket.end(); } catch {}
      if (!cert || !cert.valid_to) {
        return resolve({ sslDaysLeft: null, sslExpires: null });
      }
      const expires = new Date(cert.valid_to);
      const daysLeft = Math.round((expires.getTime() - Date.now()) / 86400000);
      resolve({ sslDaysLeft: daysLeft, sslExpires: expires.toISOString(), sslIssuer: cert.issuer?.O || null });
    });
    socket.on('error', () => resolve({ sslDaysLeft: null, sslExpires: null }));
    socket.on('timeout', () => { try { socket.destroy(); } catch {} resolve({ sslDaysLeft: null, sslExpires: null }); });
  });
}

function sniffWordPress(headers, body) {
  // Headers: x-powered-by, link rel="https://api.w.org/"
  const powered = (headers['x-powered-by'] || '').toLowerCase();
  const linkHdr = headers.link || '';
  const isWpByHeader = /wordpress/i.test(powered) || /api\.w\.org/i.test(linkHdr);

  // Body generator meta: <meta name="generator" content="WordPress 6.4.2" />
  let version = null;
  const genMatch = body && body.match(/<meta[^>]+name=["']generator["'][^>]+content=["']WordPress\s*([0-9.]+)/i);
  if (genMatch) version = genMatch[1];

  const isWp = isWpByHeader || version !== null || /wp-content\//i.test(body || '') || /wp-includes\//i.test(body || '');
  return { isWp, wpVersion: version };
}

async function readJson(req) {
  const chunks = [];
  for await (const c of req) chunks.push(c);
  const raw = Buffer.concat(chunks).toString('utf8');
  if (!raw) return {};
  try { return JSON.parse(raw); } catch { return {}; }
}

export const config = { api: { bodyParser: false } };

export default async function handler(req, res) {
  if (!process.env.WP_ACCESS_TOKEN) {
    return res.status(500).json({ error: 'server_misconfigured' });
  }
  if (unauthorized(req)) return res.status(401).json({ error: 'unauthorized' });
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'method_not_allowed' });
  }

  const body = await readJson(req);
  const parsed = parseInputUrl(body.url);
  if (!parsed) return res.status(400).json({ error: 'bad_url' });

  try {
    const [http, ssl] = await Promise.all([
      httpCheck(parsed),
      parsed.protocol === 'https:' ? sslCheck(parsed.hostname) : Promise.resolve({ sslDaysLeft: null, sslExpires: null })
    ]);
    const wp = sniffWordPress(http.headers || {}, http.body || '');

    return res.status(200).json({
      checkedAt: Date.now(),
      up: !!http.up,
      statusCode: http.statusCode,
      latencyMs: http.latencyMs,
      error: http.error || null,
      sslDaysLeft: ssl.sslDaysLeft,
      sslExpires: ssl.sslExpires,
      sslIssuer: ssl.sslIssuer || null,
      isWordPress: wp.isWp,
      wpVersion: wp.wpVersion
    });
  } catch (e) {
    return res.status(500).json({ error: e.message || 'unknown' });
  }
}
