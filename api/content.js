// GET /api/content
// Public. Returns the current saved content overrides (text + image URLs) as JSON.
// If nothing has ever been saved, returns {} so the site falls back to its built-in defaults.
import { list } from '@vercel/blob';

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store, max-age=0');
  try {
    const { blobs } = await list({ prefix: 'content.json', limit: 1 });
    if (!blobs.length) return res.status(200).json({});
    const r = await fetch(blobs[0].url, { cache: 'no-store' });
    if (!r.ok) return res.status(200).json({});
    const data = await r.json();
    return res.status(200).json(data);
  } catch (e) {
    // Blob not configured yet, or transient error — behave as "no overrides".
    return res.status(200).json({});
  }
}
