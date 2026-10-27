# School ERP — React + Node + PostgreSQL

```
client/   React (Vite) app            → deploy to Vercel / Netlify
server/   Node + Express API          → deploy to Render / Railway
          PostgreSQL database         → Neon / Render / Railway / Supabase (just as a Postgres host)
```

## 1. Run it on your computer

You need Node 18+ and a PostgreSQL database (local, or a free one from https://neon.tech).

```bash
# --- server ---
cd server
cp .env.example .env          # then edit DATABASE_URL and JWT_SECRET
npm install
npm run migrate               # creates the tables
npm run create-user -- Admin principal "School Admin" "choose-a-strong-password"
npm run dev                   # API on http://localhost:4000

# --- client (new terminal) ---
cd client
npm install
npm run dev                   # app on http://localhost:5173  (calls /api through a proxy)
```

Log in as **Admin** → open **Accounts** to create Teacher / Student / Parent logins.
Teacher accounts link to a *staff member*, Student and Parent accounts link to a *student*.

### Moving your existing demo data
Open the old app → Data → **Download backup**, then:
```bash
cd server
npm run import-backup -- path/to/school-erp-backup.json
```
(Records are imported; logins are not — create them from the Accounts page.)

## 2. Deploy

### a) Database — Neon (free)
1. Create a project at neon.tech and copy the **connection string**.
2. On your own computer, put it in `server/.env` (`DATABASE_URL=...`, `DATABASE_SSL=true`) and run
   `npm run migrate` and `npm run create-user -- Admin ...` once. (This sets up the production DB and the first admin.)

### b) API — Render
1. Push this repo to GitHub.
2. Render → New → **Web Service** → pick the repo.
   - Root directory: `server`
   - Build command: `npm install`
   - Start command: `npm start`
3. Environment variables:

   | Name | Value |
   |---|---|
   | `DATABASE_URL` | Neon connection string |
   | `DATABASE_SSL` | `true` |
   | `JWT_SECRET` | long random string (`node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"`) |
   | `CLIENT_ORIGIN` | your frontend URL, e.g. `https://school-erp.vercel.app` (no trailing `/`) |

4. Check `https://<your-api>.onrender.com/api/health` → `{"ok":true}`.
   (On Render's free plan the API sleeps when idle; the first request after a pause takes ~30–60 s.)

### c) Frontend — Vercel
1. Vercel → New Project → same repo.
   - Root directory: `client`
   - Framework: Vite (build `npm run build`, output `dist`)
2. Environment variable: `VITE_API_URL` = `https://<your-api>.onrender.com/api`
3. Deploy. Then make sure `CLIENT_ORIGIN` on Render matches the final Vercel URL exactly.

## 3. How security works
- Passwords are stored as **bcrypt** hashes on the server only; the browser never receives any hash.
- Login returns a signed token (8 h). Every request re-checks the account on the server.
- **The server decides what each role can read and change** (`server/src/rules.js`):
  students/parents only receive their own records, teachers cannot touch fees or staff, etc.
- Failed logins are rate-limited (20 per 15 min per IP).
- Keep `JWT_SECRET` and `DATABASE_URL` secret. Never put them in `client/`.

## 4. Before real students' data goes in
- Use HTTPS only (Vercel/Render do this automatically).
- Set up database backups (Neon keeps history on paid plans; also use Data → *Download backup* regularly).
- Log in once as each role and confirm what they can and cannot see.
