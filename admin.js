/* ═══════════════════════════════════════════════════════════════
   ØSTROM ADMIN EDITOR
   Click the ⚙ button in the footer → enter the password → the page
   becomes editable. "Save & Publish" sends the changes to the
   website's own server (api/publish.js), which writes them to
   GitHub, and Vercel puts them live.

   The password is checked by the server, not by this file — so it
   is not visible in the page source, and no GitHub key is ever
   needed in the browser.
   ═══════════════════════════════════════════════════════════════ */
(function () {
    'use strict';

    var API = 'api/publish';
    var DEFAULT_COLORS = { gold: '#C4963A', black: '#080808', white: '#F8F5EF' };
    var adminPw = null;       /* remembered after a successful login  */

    var editing = false;
    var dirty = false;
    var uiBuilt = false;
    var pendingImages = {};   /* key → dataURL of a newly chosen photo */
    var ov = null;            /* the overrides object we will save    */

    /* ── helpers ── */
    function $(id) { return document.getElementById(id); }
    function clone(o) { return JSON.parse(JSON.stringify(o)); }
    function lang() { return window.OSTROM.getLang(); }

    /* talk to the website's own publish server */
    function apiPost(payload) {
        return fetch(API, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        }).then(function (r) {
            return r.json().catch(function () { return {}; }).then(function (j) {
                if (!r.ok) {
                    var e = new Error(j.message || ('server said ' + r.status));
                    e.code = j.error || r.status;
                    throw e;
                }
                return j;
            });
        });
    }

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
        if (pw === null || pw === '') return;
        adminBtn.disabled = true;
        apiPost({ action: 'check', password: pw })
            .then(function () {
                adminPw = pw;
                enterEditMode();
            })
            .catch(function (err) {
                if (err.code === 'password') {
                    window.alert('Wrong password.');
                } else if (err.code === 'setup') {
                    window.alert('The publishing setup in Vercel is not finished yet, so editing is switched off. Ask Claude for the setup steps.');
                } else {
                    window.alert('Could not reach the website\'s server. Editing works on the live website (ostrom-website.vercel.app) while you are online.');
                }
            })
            .then(function () { adminBtn.disabled = false; });
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
        /* if the click landed on editable text, let the user edit the text */
        if (e.target && e.target.closest && e.target.closest('[contenteditable="true"]')) return;
        if (e.target && e.target.closest && e.target.closest('.admin-bar, .admin-panel')) return;
        /* photos are often covered by effect layers — look through every
           layer under the mouse until we find the photo itself */
        var img = null;
        var stack = document.elementsFromPoint(e.clientX, e.clientY);
        for (var i = 0; i < stack.length; i++) {
            if (stack[i].dataset && stack[i].dataset.img) { img = stack[i]; break; }
        }
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
        ['colors', 'ticker'].forEach(function (p) {
            $('adm-' + p).style.display = (p === which) ? 'block' : 'none';
        });
        panel.classList.toggle('open', which === 'colors' || which === 'ticker');
    }
    function closePanels() {
        var panel = $('adm-panel');
        if (panel) panel.classList.remove('open');
    }
    function setStatus(msg) {
        var s = $('adm-status');
        if (s) s.textContent = msg;
    }

    /* ═══ PUBLISH (send to api/publish → GitHub → Vercel redeploys) ═══ */
    var saving = false;

    function publish() {
        if (saving) return;
        saving = true;
        $('adm-save-btn').disabled = true;

        var keys = Object.keys(pendingImages);
        var chain = Promise.resolve();
        keys.forEach(function (key, i) {
            chain = chain.then(function () {
                setStatus('Uploading photo ' + (i + 1) + ' of ' + keys.length + '…');
                return apiPost({ action: 'image', password: adminPw, key: key, dataB64: pendingImages[key].split(',')[1] })
                    .then(function (resp) {
                        ov.images[key] = resp.path;
                        /* point the page at the final file name */
                        document.querySelectorAll('[data-img="' + key + '"]').forEach(function (el) { el.src = resp.path; });
                    });
            });
        });

        chain.then(function () {
            setStatus('Saving…');
            return apiPost({ action: 'content', password: adminPw, content: ov });
        }).then(function () {
            dirty = false;
            pendingImages = {};
            window.OSTROM.overrides = clone(ov);
            setStatus('✅ Published! Your changes will be live for everyone in about 1 minute.');
        }).catch(function (err) {
            if (err.code === 'password') {
                setStatus('❌ The password did not match — refresh the page and log in again.');
            } else if (err.code === 'setup') {
                setStatus('❌ The publishing setup in Vercel is not finished yet — ask Claude for the steps.');
            } else {
                setStatus('❌ Could not save: ' + (err.message || 'unknown error') + ' — please try again.');
            }
        }).then(function () {
            saving = false;
            $('adm-save-btn').disabled = false;
        });
    }
})();
