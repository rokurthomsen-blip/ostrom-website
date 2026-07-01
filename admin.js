/* ═══════════════════════════════════════════════════════════════
   ØSTROM ADMIN EDITOR
   Click the ⚙ button in the footer → enter the password → the page
   becomes editable. "Save & Publish" writes the changes to GitHub
   (content.json + any new photos), and Vercel puts them live.

   Note: this password only hides the editing screen. Publishing is
   protected by the GitHub key, which is stored only in the owner's
   own browser — so nobody else can change the live website.
   ═══════════════════════════════════════════════════════════════ */
(function () {
    'use strict';

    var PASSWORD = 'ostrom2026';
    var REPO = 'rokurthomsen-blip/ostrom-website';
    var BRANCH = 'main';
    var TOKEN_KEY = 'ostrom-gh-token';
    var DEFAULT_COLORS = { gold: '#C4963A', black: '#080808', white: '#F8F5EF' };

    var editing = false;
    var dirty = false;
    var uiBuilt = false;
    var pendingImages = {};   /* key → dataURL of a newly chosen photo */
    var ov = null;            /* the overrides object we will save    */

    /* ── helpers ── */
    function $(id) { return document.getElementById(id); }
    function clone(o) { return JSON.parse(JSON.stringify(o)); }
    function b64(str) { return btoa(unescape(encodeURIComponent(str))); }
    function lang() { return window.OSTROM.getLang(); }

    function freshOv() {
        var base = window.OSTROM.overrides ? clone(window.OSTROM.overrides) : {};
        base.colors = base.colors || {};
        base.images = base.images || {};
        base.texts = base.texts || {};
        base.texts.en = base.texts.en || {};
        base.texts.fo = base.texts.fo || {};
        base.shared = base.shared || {};
        return base;
    }

    /* ═══ ENTRY ═══ */
    var adminBtn = $('adminBtn');
    if (!adminBtn) return;
    adminBtn.addEventListener('click', function () {
        if (editing) { openPanel('menu'); return; }
        var pw = window.prompt('Admin password:');
        if (pw === null) return;
        if (pw !== PASSWORD) { window.alert('Wrong password.'); return; }
        enterEditMode();
    });

    function enterEditMode() {
        editing = true;
        ov = freshOv();
        if (!uiBuilt) buildUI();
        document.body.classList.add('admin-mode');
        document.querySelectorAll('[data-i18n],[data-i18n-html],[data-edit],[data-edit-html]').forEach(function (el) {
            el.setAttribute('contenteditable', 'true');
            el.setAttribute('spellcheck', 'false');
        });
        setStatus('');
        window.scrollBy(0, 1); /* nudge so the bar paints */
    }

    function exitEditMode() {
        if (dirty && !window.confirm('You have changes that are NOT published yet. Leave anyway?')) return;
        editing = false;
        dirty = false;
        pendingImages = {};
        document.body.classList.remove('admin-mode');
        closePanels();
        document.querySelectorAll('[contenteditable]').forEach(function (el) {
            el.removeAttribute('contenteditable');
            el.removeAttribute('spellcheck');
        });
    }

    window.addEventListener('beforeunload', function (e) {
        if (editing && dirty) { e.preventDefault(); e.returnValue = ''; }
    });

    /* ═══ CAPTURE TEXT EDITS ═══ */
    document.addEventListener('input', function (e) {
        if (!editing) return;
        var el = e.target && e.target.closest ? e.target.closest('[contenteditable="true"]') : null;
        if (!el) return;
        var t = window.OSTROM.t;
        if (el.dataset.i18n) {
            ov.texts[lang()][el.dataset.i18n] = el.textContent;
            t[lang()][el.dataset.i18n] = el.textContent;
        } else if (el.dataset.i18nHtml) {
            ov.texts[lang()][el.dataset.i18nHtml] = el.innerHTML;
            t[lang()][el.dataset.i18nHtml] = el.innerHTML;
        } else if (el.dataset.edit) {
            ov.shared[el.dataset.edit] = el.textContent;
        } else if (el.dataset.editHtml) {
            ov.shared[el.dataset.editHtml] = el.innerHTML;
        } else { return; }
        dirty = true;
    });

    /* In edit mode links must not navigate away (but admin panel links may) */
    document.addEventListener('click', function (e) {
        if (!editing) return;
        var a = e.target && e.target.closest ? e.target.closest('a') : null;
        if (a && !a.closest('.admin-panel') && !a.closest('.admin-bar')) e.preventDefault();
    }, true);

    /* ═══ PHOTO SWAPPING ═══ */
    var fileInput = document.createElement('input');
    fileInput.type = 'file';
    fileInput.accept = 'image/*';
    fileInput.style.display = 'none';
    var pickTarget = null;
    document.addEventListener('DOMContentLoaded', function () { document.body.appendChild(fileInput); });
    if (document.body) document.body.appendChild(fileInput);

    document.addEventListener('click', function (e) {
        if (!editing) return;
        var img = e.target && e.target.closest ? e.target.closest('[data-img]') : null;
        if (!img) return;
        e.preventDefault();
        e.stopPropagation();
        pickTarget = img;
        fileInput.value = '';
        fileInput.click();
    }, true);

    fileInput.addEventListener('change', function () {
        var file = fileInput.files && fileInput.files[0];
        if (!file || !pickTarget) return;
        var target = pickTarget;
        shrinkImage(file, function (dataURL) {
            target.src = dataURL;
            pendingImages[target.dataset.img] = dataURL;
            dirty = true;
            setStatus('Photo changed — press "Save & Publish" when you are done.');
        });
    });

    /* Shrink big photos so the site stays fast (max 1600px, JPEG) */
    function shrinkImage(file, cb) {
        var img = new Image();
        var url = URL.createObjectURL(file);
        img.onload = function () {
            var MAX = 1600;
            var w = img.width, h = img.height;
            if (w > MAX || h > MAX) {
                var s = MAX / Math.max(w, h);
                w = Math.round(w * s); h = Math.round(h * s);
            }
            var c = document.createElement('canvas');
            c.width = w; c.height = h;
            c.getContext('2d').drawImage(img, 0, 0, w, h);
            URL.revokeObjectURL(url);
            cb(c.toDataURL('image/jpeg', 0.85));
        };
        img.onerror = function () { URL.revokeObjectURL(url); window.alert('That file does not look like a photo.'); };
        img.src = url;
    }

    /* ═══ ADMIN UI ═══ */
    function buildUI() {
        uiBuilt = true;
        var bar = document.createElement('div');
        bar.className = 'admin-bar';
        bar.innerHTML =
            '<span class="admin-hint">✏️ Click any text to edit it · 📷 Click any photo to swap it · Use EN/FO to edit both languages</span>' +
            '<button class="admin-btn" id="adm-colors-btn">🎨 Colors</button>' +
            '<button class="admin-btn" id="adm-ticker-btn">Scrolling text</button>' +
            '<button class="admin-btn primary" id="adm-save-btn">💾 Save &amp; Publish</button>' +
            '<button class="admin-btn" id="adm-exit-btn">✖ Exit</button>' +
            '<span class="admin-status" id="adm-status"></span>';
        document.body.appendChild(bar);

        var panel = document.createElement('div');
        panel.className = 'admin-panel';
        panel.id = 'adm-panel';
        panel.innerHTML =
            /* colors */
            '<div id="adm-colors" style="display:none">' +
            '  <h3>Website colors</h3>' +
            '  <p>Pick a color — the whole website updates instantly. All the lighter and darker shades follow automatically.</p>' +
            '  <label>Accent color (the gold) <input type="color" id="adm-c-gold"></label>' +
            '  <label>Background color <input type="color" id="adm-c-black"></label>' +
            '  <label>Text color <input type="color" id="adm-c-white"></label>' +
            '  <div class="admin-row">' +
            '    <button class="admin-btn" id="adm-c-reset">Back to original colors</button>' +
            '    <button class="admin-btn" id="adm-c-close">Done</button>' +
            '  </div>' +
            '</div>' +
            /* ticker */
            '<div id="adm-ticker" style="display:none">' +
            '  <h3>Scrolling text band</h3>' +
            '  <p>These words scroll across the band near the top. Separate them with commas. This saves for the language currently selected (EN/FO).</p>' +
            '  <textarea id="adm-ticker-text" rows="3"></textarea>' +
            '  <div class="admin-row">' +
            '    <button class="admin-btn primary" id="adm-ticker-apply">Apply</button>' +
            '    <button class="admin-btn" id="adm-ticker-close">Cancel</button>' +
            '  </div>' +
            '</div>' +
            /* github token */
            '<div id="adm-token" style="display:none">' +
            '  <h3>One-time setup — connect to GitHub</h3>' +
            '  <p id="adm-token-msg">To publish your changes, the editor needs a secret key from your GitHub account. You only do this once on this computer.</p>' +
            '  <ol>' +
            '    <li><a href="https://github.com/settings/personal-access-tokens/new" target="_blank" rel="noopener">Click here to open the GitHub key page</a> (log in if it asks).</li>' +
            '    <li>Token name: type <strong>website-editor</strong></li>' +
            '    <li>Expiration: pick the longest option available.</li>' +
            '    <li>Under <strong>Repository access</strong> choose <strong>Only select repositories</strong> and pick <strong>ostrom-website</strong>.</li>' +
            '    <li>Open <strong>Repository permissions</strong>, find <strong>Contents</strong>, set it to <strong>Read and write</strong>.</li>' +
            '    <li>Press the green <strong>Generate token</strong> button at the bottom.</li>' +
            '    <li>Copy the long code it shows you and paste it below.</li>' +
            '  </ol>' +
            '  <input type="password" id="adm-token-input" placeholder="Paste the secret key here">' +
            '  <div class="admin-row">' +
            '    <button class="admin-btn primary" id="adm-token-save">Save key &amp; publish</button>' +
            '    <button class="admin-btn" id="adm-token-cancel">Cancel</button>' +
            '  </div>' +
            '</div>';
        document.body.appendChild(panel);

        /* colors */
        $('adm-colors-btn').addEventListener('click', function () { initColorInputs(); openPanel('colors'); });
        $('adm-c-close').addEventListener('click', closePanels);
        ['gold', 'black', 'white'].forEach(function (name) {
            $('adm-c-' + name).addEventListener('input', function () {
                document.documentElement.style.setProperty('--' + name, this.value);
                ov.colors[name] = this.value;
                dirty = true;
            });
        });
        $('adm-c-reset').addEventListener('click', function () {
            ['gold', 'black', 'white'].forEach(function (name) {
                document.documentElement.style.removeProperty('--' + name);
                $('adm-c-' + name).value = DEFAULT_COLORS[name];
            });
            ov.colors = {};
            dirty = true;
        });

        /* ticker */
        $('adm-ticker-btn').addEventListener('click', function () {
            $('adm-ticker-text').value = tickerWords().join(', ');
            openPanel('ticker');
        });
        $('adm-ticker-close').addEventListener('click', closePanels);
        $('adm-ticker-apply').addEventListener('click', function () {
            var words = $('adm-ticker-text').value.split(',').map(function (w) { return w.trim(); }).filter(Boolean);
            if (!words.length) return;
            /* repeat the words twice so the band loops smoothly */
            var seq = words.concat(words).map(function (w) { return w + ' <span class="dot"></span>'; }).join(' ');
            ov.texts[lang()].ticker = seq;
            window.OSTROM.t[lang()].ticker = seq;
            window.OSTROM.applyLang();
            dirty = true;
            closePanels();
            setStatus('Scrolling text updated — press "Save & Publish" when you are done.');
        });

        /* token */
        $('adm-token-cancel').addEventListener('click', closePanels);
        $('adm-token-save').addEventListener('click', function () {
            var v = $('adm-token-input').value.trim();
            if (!v) { window.alert('Please paste the key first.'); return; }
            try { localStorage.setItem(TOKEN_KEY, v); } catch (e) {}
            $('adm-token-input').value = '';
            closePanels();
            publish();
        });

        /* save / exit */
        $('adm-save-btn').addEventListener('click', publish);
        $('adm-exit-btn').addEventListener('click', exitEditMode);
    }

    function initColorInputs() {
        var cs = getComputedStyle(document.documentElement);
        ['gold', 'black', 'white'].forEach(function (name) {
            var v = (ov.colors[name] || cs.getPropertyValue('--' + name) || DEFAULT_COLORS[name]).trim();
            if (!/^#[0-9a-fA-F]{6}$/.test(v)) v = DEFAULT_COLORS[name];
            $('adm-c-' + name).value = v;
        });
    }

    function tickerWords() {
        var html = window.OSTROM.t[lang()].ticker || '';
        var words = html.split(/<span[^>]*><\/span>/).map(function (w) { return w.trim(); }).filter(Boolean);
        var seen = {}, out = [];
        words.forEach(function (w) { if (!seen[w]) { seen[w] = 1; out.push(w); } });
        return out;
    }

    function openPanel(which) {
        var panel = $('adm-panel');
        ['colors', 'ticker', 'token'].forEach(function (p) {
            $('adm-' + p).style.display = (p === which) ? 'block' : 'none';
        });
        panel.classList.toggle('open', which === 'colors' || which === 'ticker' || which === 'token');
    }
    function closePanels() {
        var panel = $('adm-panel');
        if (panel) panel.classList.remove('open');
    }
    function setStatus(msg) {
        var s = $('adm-status');
        if (s) s.textContent = msg;
    }

    /* ═══ PUBLISH (save to GitHub → Vercel redeploys) ═══ */
    var saving = false;

    function publish() {
        if (saving) return;
        var token = null;
        try { token = localStorage.getItem(TOKEN_KEY); } catch (e) {}
        if (!token) { openPanel('token'); return; }
        saving = true;
        $('adm-save-btn').disabled = true;
        doPublish(token)
            .then(function () {
                dirty = false;
                pendingImages = {};
                window.OSTROM.overrides = clone(ov);
                setStatus('✅ Published! Your changes will be live for everyone in about 1 minute.');
            })
            .catch(function (err) {
                if (err && (err.status === 401 || err.status === 403)) {
                    try { localStorage.removeItem(TOKEN_KEY); } catch (e) {}
                    $('adm-token-msg').textContent = 'That key did not work (it may have expired). Please make a new one:';
                    openPanel('token');
                    setStatus('');
                } else {
                    setStatus('❌ Could not save: ' + ((err && err.message) || 'unknown error') + ' — please try again.');
                }
            })
            .then(function () {
                saving = false;
                $('adm-save-btn').disabled = false;
            });
    }

    function doPublish(token) {
        var keys = Object.keys(pendingImages);
        var chain = Promise.resolve();
        keys.forEach(function (key, i) {
            chain = chain.then(function () {
                setStatus('Uploading photo ' + (i + 1) + ' of ' + keys.length + '…');
                var path = 'images/' + key + '-' + Date.now() + '.jpg';
                return ghPut(token, path, pendingImages[key].split(',')[1], 'Update photo: ' + key, null)
                    .then(function () {
                        ov.images[key] = path;
                        /* point the page at the final file name */
                        document.querySelectorAll('[data-img="' + key + '"]').forEach(function (el) { el.src = path; });
                    });
            });
        });
        return chain.then(function () {
            setStatus('Saving…');
            return ghGetSha(token, 'content.json');
        }).then(function (sha) {
            return ghPut(token, 'content.json', b64(JSON.stringify(ov, null, 2)), 'Update website content (admin editor)', sha);
        });
    }

    function ghGetSha(token, path) {
        return fetch('https://api.github.com/repos/' + REPO + '/contents/' + path + '?ref=' + BRANCH, {
            headers: { 'Authorization': 'Bearer ' + token, 'Accept': 'application/vnd.github+json' }
        }).then(function (r) {
            if (r.status === 404) return null;
            if (!r.ok) { var e = new Error('GitHub said ' + r.status); e.status = r.status; throw e; }
            return r.json().then(function (j) { return j.sha; });
        });
    }

    function ghPut(token, path, contentB64, message, sha) {
        var body = { message: message, content: contentB64, branch: BRANCH };
        if (sha) body.sha = sha;
        return fetch('https://api.github.com/repos/' + REPO + '/contents/' + path, {
            method: 'PUT',
            headers: { 'Authorization': 'Bearer ' + token, 'Accept': 'application/vnd.github+json' },
            body: JSON.stringify(body)
        }).then(function (r) {
            if (!r.ok) { var e = new Error('GitHub said ' + r.status); e.status = r.status; throw e; }
            return r.json();
        });
    }
})();
