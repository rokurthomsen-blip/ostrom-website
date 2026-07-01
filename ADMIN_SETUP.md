# Admin content editor — setup

Your site now has a built‑in admin panel that lets you edit **all the text** and
**swap any photo** directly on the page, with changes saved so **every visitor sees them**.

Because the site is hosted on Vercel, the editor saves through two small serverless
functions and **Vercel Blob** storage. You need to do a one‑time setup in the Vercel
dashboard before it works live. It takes about 3 minutes.

---

## What you have to do (one time)

### 1. Set an admin password
1. Go to your project on [vercel.com](https://vercel.com) → **Settings → Environment Variables**.
2. Add a new variable:
   - **Name:** `ADMIN_PASSWORD`
   - **Value:** whatever password you want (pick a strong one).
   - **Environments:** tick Production (and Preview if you want).
3. Save.

### 2. Turn on Blob storage (for saving text + photos)
1. In your project, open the **Storage** tab.
2. Create a **Blob** store and **connect it to this project**.
   - Vercel automatically adds the `BLOB_READ_WRITE_TOKEN` variable for you — you don't
     have to copy anything.

### 3. Redeploy
Trigger a redeploy (push any commit, or click **Redeploy** on the latest deployment) so
the new password and storage take effect.

That's it. 🎉

---

## How to use it

1. Scroll to the very bottom of the site and click the small **“Admin”** link in the footer.
   (Or press **Ctrl/Cmd + Shift + A** anywhere.)
2. Enter your password.
3. You're now in **edit mode**:
   - **Text:** click any text and type to change it. Dashed gold outlines show what's editable.
   - **Photos:** hover a photo and click **“📷 Change photo”** to upload a new one from your
     computer. (Images are automatically resized for fast loading.)
   - **Languages:** the site has English and Faroese. Edit one, then use the **EN / FO**
     switch at the top to edit the other. Each language is saved separately.
4. Click **“Save changes”** in the bottom bar. Your edits go live for everyone immediately.
5. Click **“Exit”** when you're done.

To undo everything back to the original, the simplest reset is to delete the `content.json`
object in your Blob store (Storage tab → your Blob store → delete `content.json`).

---

## Notes / limits

- **Security:** the password is checked on the server, not stored in the page. Still, treat
  it like any password — anyone who has it can edit the site. It is *not* a full user system.
- **What's editable:** all marketing text, headings, reviews, opening hours, the stat numbers,
  and all 11 photos. Link targets (phone number `tel:` / email / social URLs) are not edited
  by the panel — ask if you want those made editable too.
- **Before setup / on a plain file open:** if the backend isn't configured yet, the site still
  works and shows its built‑in defaults; the Admin login will just say it can't reach the server.

---

## Files involved
- `api/login.js` – checks the password.
- `api/content.js` – serves saved content to every visitor (public).
- `api/save.js` – saves text/photo changes (password‑protected).
- `api/upload.js` – stores uploaded photos in Blob (password‑protected).
- `package.json` – declares the `@vercel/blob` dependency.
- `index.html` – the editor UI + logic (search for “ADMIN CONTENT EDITOR”).
