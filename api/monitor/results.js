// Monitor results — latest ping outcome per monitored site, written by the cron.
// Read-only for the client.

import { head } from '@vercel/blob';

const KEY = 'monitor/results.json';

function unauthorized(req) {
  const token = req.headers['x-access-token'];
  return !token || token !== process.env.WP_ACCESS_TOKEN;
}

export default async function handler(req, res) {
  if (!process.env.WP_ACCESS_TOKEN || !process.env.BLOB_READ_WRITE_TOKEN) {
    return res.status(500).json({ error: 'server_misconfigured' });
  }
  if (unauthorized(req)) return res.status(401).json({ error: 'unauthorized' });
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ error: 'method_not_allowed' });
  }

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
      return res.status(200).json({ results: [], ranAt: null });
    }
    return res.status(500).json({ error: msg || 'unknown' });
  }
}
