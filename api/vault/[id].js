// File vault — one encrypted blob per file. [id] is a UUID generated client-side.
// Server never sees plaintext; it just stores/returns ciphertext.

import { put, head, del } from '@vercel/blob';

const PREFIX = 'vault/';
const MAX_BODY = 10 * 1024 * 1024; // 10 MB per file

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

function safeId(id) {
  return typeof id === 'string' && /^[A-Za-z0-9_-]{3,64}$/.test(id);
}

export default async function handler(req, res) {
  if (!process.env.WP_ACCESS_TOKEN || !process.env.BLOB_READ_WRITE_TOKEN) {
    return res.status(500).json({ error: 'server_misconfigured' });
  }
  if (unauthorized(req)) return res.status(401).json({ error: 'unauthorized' });

  const { id } = req.query;
  if (!safeId(id)) return res.status(400).json({ error: 'bad_id' });
  const key = PREFIX + id;

  try {
    if (req.method === 'GET') {
      let info;
      try {
        info = await head(key);
      } catch (e) {
        const msg = (e && e.message) || '';
        if (e && (e.status === 404 || e.name === 'BlobNotFoundError' || /not found|does not exist/i.test(msg))) {
          return res.status(404).json({ error: 'not_found' });
        }
        throw e;
      }
      const url = info.downloadUrl || info.url;
      const r = await fetch(url, { cache: 'no-store' });
      if (!r.ok) return res.status(502).json({ error: 'blob_fetch_failed' });
      const buf = Buffer.from(await r.arrayBuffer());
      res.setHeader('Content-Type', 'application/octet-stream');
      res.setHeader('Cache-Control', 'no-store');
      return res.send(buf);
    }

    if (req.method === 'PUT') {
      const body = await readRawBody(req);
      if (body.length < 28) return res.status(400).json({ error: 'blob_too_small' });
      const blob = await put(key, body, {
        access: 'public',
        addRandomSuffix: false,
        allowOverwrite: true,
        contentType: 'application/octet-stream'
      });
      return res.status(200).json({ ok: true, size: body.length, uploadedAt: blob.uploadedAt });
    }

    if (req.method === 'DELETE') {
      try {
        const info = await head(key);
        await del(info.url);
      } catch (e) {
        const msg = (e && e.message) || '';
        if (!(e && (e.status === 404 || e.name === 'BlobNotFoundError' || /not found|does not exist/i.test(msg)))) {
          throw e;
        }
      }
      return res.status(200).json({ ok: true });
    }

    res.setHeader('Allow', 'GET, PUT, DELETE');
    return res.status(405).json({ error: 'method_not_allowed' });
  } catch (e) {
    const msg = (e && e.message) || 'unknown';
    const status = msg === 'BODY_TOO_LARGE' ? 413 : 500;
    return res.status(status).json({ error: msg });
  }
}
