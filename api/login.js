// POST /api/login
// Verifies the admin password so the panel can give immediate feedback.
// The real protection is that every write (save/upload) re-checks the password server-side.
export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const expected = process.env.ADMIN_PASSWORD;
  if (!expected) return res.status(500).json({ ok: false, error: 'ADMIN_PASSWORD is not configured on the server.' });

  const body = typeof req.body === 'string' ? safeParse(req.body) : req.body || {};
  if (body.password && body.password === expected) return res.status(200).json({ ok: true });
  return res.status(401).json({ ok: false, error: 'Wrong password.' });
}

function safeParse(s) { try { return JSON.parse(s); } catch { return {}; } }
