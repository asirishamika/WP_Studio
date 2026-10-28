// Monitor site list — plaintext JSON blob that holds the URLs opted-in for
// background cron pings. It only ever contains URLs + ids, no secrets.

import { put, head } from '@vercel/blob';

const KEY = 'monitor/sites.json';

function unauthorized(req) {
  const token = req.headers['x-access-token'];
  return !token || token !== process.env.WP_ACCESS_TOKEN;
}

async function readRawBody(req) {
  const chunks = [];
  for await (const c of req) chunks.push(c);
  return Buffer.concat(chunks).toString('utf8');
}

export const config = { api: { bodyParser: false } };

export default async function handler(req, res) {
  if (!process.env.WP_ACCESS_TOKEN || !process.env.BLOB_READ_WRITE_TOKEN) {
    return res.status(500).json({ error: 'server_misconfigured' });
  }
  if (unauthorized(req)) return res.status(401).json({ error: 'unauthorized' });

  try {
    if (req.method === 'GET') {
      try {
        const info = await head(KEY);
        const url = info.downloadUrl || info.url;
        const r = await fetch(url, { cache: 'no-store' });
        const text = await r.text();
        res.setHeader('Cache-Control', 'no-store');
        res.setHeader('Content-Type', 'application/json');
        return res.send(text);
      } catch (e) {
        const msg = (e && e.message) || '';
        if (e && (e.status === 404 || e.name === 'BlobNotFoundError' || /not found|does not exist/i.test(msg))) {
          return res.status(200).json({ sites: [] });
        }
        throw e;
      }
    }

    if (req.method === 'PUT') {
      const body = await readRawBody(req);
      let parsed;
      try { parsed = JSON.parse(body); } catch { return res.status(400).json({ error: 'bad_json' }); }
      if (!Array.isArray(parsed.sites)) return res.status(400).json({ error: 'bad_shape' });
      // Shape-check each entry.
      const sites = parsed.sites
        .filter(s => s && typeof s.id === 'string' && typeof s.url === 'string')
        .map(s => ({ id: s.id.slice(0, 64), url: s.url.slice(0, 2048) }));
      const payload = JSON.stringify({ sites, updatedAt: Date.now() });
      await put(KEY, Buffer.from(payload, 'utf8'), {
        access: 'public',
        addRandomSuffix: false,
        allowOverwrite: true,
        contentType: 'application/json'
      });
      return res.status(200).json({ ok: true, count: sites.length });
    }

    res.setHeader('Allow', 'GET, PUT');
    return res.status(405).json({ error: 'method_not_allowed' });
  } catch (e) {
    return res.status(500).json({ error: (e && e.message) || 'unknown' });
  }
}
