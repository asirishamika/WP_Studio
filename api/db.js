// Thin proxy to Vercel Blob. The blob is ciphertext — the server never sees
// plaintext. One shared access token (env var) gates reads and writes.

import { put, head } from '@vercel/blob';

const DB_KEY = 'db/main.enc';
const MAX_BODY = 8 * 1024 * 1024; // 8 MB cap for Phase 1

export const config = { api: { bodyParser: false } };

function unauthorized(req) {
  const token = req.headers['x-access-token'];
  return !token || token !== process.env.WP_ACCESS_TOKEN;
}

async function readRawBody(req) {
  const chunks = [];
  let size = 0;
  for await (const chunk of req) {
    size += chunk.length;
    if (size > MAX_BODY) throw new Error('BODY_TOO_LARGE');
    chunks.push(chunk);
  }
  return Buffer.concat(chunks);
}

export default async function handler(req, res) {
  if (!process.env.WP_ACCESS_TOKEN) {
    return res.status(500).json({ error: 'server_misconfigured_WP_ACCESS_TOKEN_missing' });
  }
  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    return res.status(500).json({ error: 'server_misconfigured_BLOB_READ_WRITE_TOKEN_missing' });
  }
  if (unauthorized(req)) {
    return res.status(401).json({ error: 'unauthorized' });
  }

  try {
    if (req.method === 'GET') {
      let info;
      try {
        info = await head(DB_KEY);
      } catch (e) {
        if (e && (e.status === 404 || /not found/i.test(e.message || ''))) {
          return res.status(404).json({ error: 'not_found' });
        }
        throw e;
      }
      const r = await fetch(info.url, { cache: 'no-store' });
      if (!r.ok) return res.status(502).json({ error: 'blob_fetch_failed' });
      const buf = Buffer.from(await r.arrayBuffer());
      res.setHeader('Content-Type', 'application/octet-stream');
      res.setHeader('Cache-Control', 'no-store');
      res.setHeader('X-Blob-Updated-At', info.uploadedAt || '');
      return res.send(buf);
    }

    if (req.method === 'PUT') {
      const body = await readRawBody(req);
      if (body.length < 28) return res.status(400).json({ error: 'blob_too_small' });
      const blob = await put(DB_KEY, body, {
        access: 'public',
        addRandomSuffix: false,
        allowOverwrite: true,
        contentType: 'application/octet-stream'
      });
      return res.status(200).json({ ok: true, uploadedAt: blob.uploadedAt, size: body.length });
    }

    res.setHeader('Allow', 'GET, PUT');
    return res.status(405).json({ error: 'method_not_allowed' });
  } catch (e) {
    const msg = (e && e.message) || 'unknown';
    const status = msg === 'BODY_TOO_LARGE' ? 413 : 500;
    return res.status(status).json({ error: msg });
  }
}
