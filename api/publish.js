/* ═══════════════════════════════════════════════════════════════
   ØSTROM PUBLISH API (runs on Vercel, not in the browser)

   The admin editor on the site sends changes here. This code checks
   the admin password and then writes the changes to GitHub, which
   makes Vercel rebuild the live site.

   Needs two Environment Variables set in the Vercel project:
     ADMIN_PASSWORD — the password the owner types in the admin panel
     GITHUB_TOKEN   — a GitHub access token with write access to the repo
   ═══════════════════════════════════════════════════════════════ */
'use strict';

const crypto = require('crypto');

const REPO = 'rokurthomsen-blip/ostrom-website';
const BRANCH = 'main';

function sameString(a, b) {
    const ha = crypto.createHash('sha256').update(String(a)).digest();
    const hb = crypto.createHash('sha256').update(String(b)).digest();
    return crypto.timingSafeEqual(ha, hb);
}

function gh(token, path, options) {
    return fetch('https://api.github.com/repos/' + REPO + '/contents/' + path, {
        method: (options && options.method) || 'GET',
        headers: {
            'Authorization': 'Bearer ' + token,
            'Accept': 'application/vnd.github+json',
            'User-Agent': 'ostrom-website-editor'
        },
        body: options && options.body ? JSON.stringify(options.body) : undefined
    });
}

async function ghGetSha(token, path) {
    const r = await gh(token, path + '?ref=' + BRANCH);
    if (r.status === 404) return null;
    if (!r.ok) throw new Error('GitHub said ' + r.status);
    const j = await r.json();
    return j.sha;
}

async function ghPut(token, path, contentB64, message, sha) {
    const body = { message: message, content: contentB64, branch: BRANCH };
    if (sha) body.sha = sha;
    const r = await gh(token, path, { method: 'PUT', body: body });
    if (!r.ok) throw new Error('GitHub said ' + r.status);
    return r.json();
}

module.exports = async (req, res) => {
    if (req.method !== 'POST') {
        res.status(405).json({ error: 'method' });
        return;
    }

    /* Accept the standard names, or the names actually used in this
       project's Vercel dashboard (admin_panel / TOKEN_OSTROM). */
    const expected = process.env.ADMIN_PASSWORD || process.env.admin_panel;
    const token = process.env.GITHUB_TOKEN || process.env.TOKEN_OSTROM;
    if (!expected || !token) {
        /* the one-time setup in the Vercel dashboard has not been done yet */
        res.status(500).json({ error: 'setup' });
        return;
    }

    const body = req.body || {};
    if (!body.password || !sameString(body.password, expected)) {
        res.status(401).json({ error: 'password' });
        return;
    }

    try {
        if (body.action === 'check') {
            res.status(200).json({ ok: true });

        } else if (body.action === 'image') {
            /* one photo per request, so uploads stay small */
            if (!/^[a-z0-9-]{1,60}$/i.test(body.key || '') || typeof body.dataB64 !== 'string') {
                res.status(400).json({ error: 'bad-image' });
                return;
            }
            const path = 'images/' + body.key + '-' + Date.now() + '.jpg';
            await ghPut(token, path, body.dataB64, 'Update photo: ' + body.key + ' (admin editor)', null);
            res.status(200).json({ ok: true, path: path });

        } else if (body.action === 'content') {
            if (!body.content || typeof body.content !== 'object') {
                res.status(400).json({ error: 'bad-content' });
                return;
            }
            const b64 = Buffer.from(JSON.stringify(body.content, null, 2), 'utf8').toString('base64');
            const sha = await ghGetSha(token, 'content.json');
            await ghPut(token, 'content.json', b64, 'Update website content (admin editor)', sha);
            res.status(200).json({ ok: true });

        } else {
            res.status(400).json({ error: 'bad-action' });
        }
    } catch (err) {
        res.status(502).json({ error: 'github', message: err.message });
    }
};
