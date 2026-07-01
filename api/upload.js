// POST /api/upload
// Password-protected image upload. The browser downscales the photo and sends it as a
// base64 data URL; this handler verifies the admin password, decodes it, and stores it
// in Vercel Blob, returning a public URL. Body: { password, filename, dataUrl }.
import { put } from '@vercel/blob';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const expected = process.env.ADMIN_PASSWORD;
  if (!expected) return res.status(500).json({ error: 'ADMIN_PASSWORD is not configured on the server.' });

  const body = typeof req.body === 'string' ? safeParse(req.body) : req.body || {};
  const { password, filename, dataUrl } = body;

  if (!password || password !== expected) return res.status(401).json({ error: 'Wrong password.' });
  if (!dataUrl) return res.status(400).json({ error: 'Missing image data.' });

  const m = /^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/.exec(dataUrl);
  if (!m) return res.status(400).json({ error: 'Invalid image data.' });

  const contentType = m[1];
  const buffer = Buffer.from(m[2], 'base64');
  const ext = contentType.split('/')[1].replace('jpeg', 'jpg').replace('svg+xml', 'svg');
  const base = String(filename || 'image').replace(/\.[^.]+$/, '').replace(/[^a-z0-9._-]/gi, '-').slice(0, 40) || 'image';

  try {
    const blob = await put(`uploads/${base}.${ext}`, buffer, {
      access: 'public',
      contentType,
      addRandomSuffix: true,
    });
    return res.status(200).json({ url: blob.url });
  } catch (e) {
    return res.status(500).json({ error: 'Upload failed. Is Blob storage connected? ' + e.message });
  }
}

function safeParse(s) { try { return JSON.parse(s); } catch { return {}; } }
