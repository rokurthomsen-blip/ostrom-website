// POST /api/save
// Password-protected. Persists the content overrides JSON to Vercel Blob at a fixed path,
// so every visitor sees the edits. Body: { password, content }.
import { put } from '@vercel/blob';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const expected = process.env.ADMIN_PASSWORD;
  if (!expected) return res.status(500).json({ error: 'ADMIN_PASSWORD is not configured on the server.' });

  const body = typeof req.body === 'string' ? safeParse(req.body) : req.body || {};
  const { password, content } = body;

  if (!password || password !== expected) return res.status(401).json({ error: 'Wrong password.' });
  if (!content || typeof content !== 'object') return res.status(400).json({ error: 'Missing content.' });

  try {
    const blob = await put('content.json', JSON.stringify(content), {
      access: 'public',
      contentType: 'application/json',
      allowOverwrite: true,
      addRandomSuffix: false,
    });
    return res.status(200).json({ ok: true, url: blob.url });
  } catch (e) {
    return res.status(500).json({ error: 'Could not save. Is Blob storage connected? ' + e.message });
  }
}

function safeParse(s) { try { return JSON.parse(s); } catch { return {}; } }
