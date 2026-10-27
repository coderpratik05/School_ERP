import "dotenv/config";
import crypto from "node:crypto";
import express from "express";
import helmet from "helmet";
import cors from "cors";
import rateLimit from "express-rate-limit";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { q, tx } from "./db.js";
import { COLLECTIONS, canWrite, canDelete, readFilter, shape, isKid } from "./rules.js";

const { JWT_SECRET, CLIENT_ORIGIN = "http://localhost:5173", PORT = 4000 } = process.env;
if (!JWT_SECRET || JWT_SECRET.length < 32) { console.error("JWT_SECRET must be set (32+ characters). See .env.example"); process.exit(1); }
if (!process.env.DATABASE_URL) { console.error("DATABASE_URL must be set. See .env.example"); process.exit(1); }

const app = express();
app.set("trust proxy", 1); // behind Render / Railway / Vercel proxies
app.use(helmet());
app.use(cors({ origin: CLIENT_ORIGIN.split(",").map((s) => s.trim()), methods: ["GET", "POST", "PUT", "DELETE"] }));
app.use(express.json({ limit: "2mb" }));

const ROLES = ["Admin", "Teacher", "Student", "Parent"];
const wrap = (fn) => (req, res, next) => fn(req, res, next).catch(next);
const bad = (res, msg, code = 400) => res.status(code).json({ error: msg });
const publicUser = (u) => ({ id: u.id, username: u.username, role: u.role, name: u.name, linkedId: u.linked_id });
const str = (v, max = 100) => typeof v === "string" && v.trim().length > 0 && v.length <= max;

/* ---------- Auth ---------- */
const DUMMY = bcrypt.hashSync("not-a-real-password", 10); // equalises timing for unknown usernames
const loginLimiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: 20, skipSuccessfulRequests: true, standardHeaders: true, legacyHeaders: false, message: { error: "Too many attempts. Try again in a few minutes." } });

app.get("/api/health", (_req, res) => res.json({ ok: true }));

app.post("/api/auth/login", loginLimiter, wrap(async (req, res) => {
  const { role, username, password } = req.body || {};
  if (!ROLES.includes(role) || !str(username) || !str(password, 200)) return bad(res, "Invalid username, password, or role.", 401);
  const { rows } = await q("SELECT * FROM users WHERE username = $1 AND role = $2", [username.trim().toLowerCase(), role]);
  const u = rows[0];
  const ok = await bcrypt.compare(password, u ? u.password_hash : DUMMY);
  if (!u || !ok) return bad(res, "Invalid username, password, or role.", 401);
  const token = jwt.sign({ sub: u.id }, JWT_SECRET, { expiresIn: "8h" });
  res.json({ token, user: publicUser(u) });
}));

const auth = wrap(async (req, res, next) => {
  const h = req.headers.authorization || "";
  try {
    const { sub } = jwt.verify(h.startsWith("Bearer ") ? h.slice(7) : "", JWT_SECRET);
    const { rows } = await q("SELECT * FROM users WHERE id = $1", [sub]); // re-check on every request
    if (!rows[0]) throw new Error("gone");
    req.user = { ...publicUser(rows[0]), hash: rows[0].password_hash };
    next();
  } catch { bad(res, "Please sign in again.", 401); }
});
const adminOnly = (req, res, next) => (req.user.role === "Admin" ? next() : bad(res, "Admin only.", 403));

app.get("/api/auth/me", auth, (req, res) => res.json({ user: publicUser({ ...req.user, linked_id: req.user.linkedId }) }));

app.post("/api/auth/change-password", auth, loginLimiter, wrap(async (req, res) => {
  const { current, next } = req.body || {};
  if (!str(next, 200) || next.length < 8) return bad(res, "New password must be at least 8 characters.");
  if (!(await bcrypt.compare(String(current || ""), req.user.hash))) return bad(res, "Current password is incorrect.", 403);
  await q("UPDATE users SET password_hash = $1 WHERE id = $2", [await bcrypt.hash(next, 10), req.user.id]);
  res.json({ ok: true });
}));

/* ---------- Data ---------- */
async function loadCollection(user, name, klass) {
  const f = readFilter(user, name, klass);
  const { rows } = await q(`SELECT data FROM records WHERE collection = $1 ${f.where} ORDER BY seq`, [name, ...f.params]);
  return rows.map((r) => shape(user, name, r.data));
}

// Everything the logged-in user is allowed to see, in one request
app.get("/api/data", auth, wrap(async (req, res) => {
  let klass = null;
  if (isKid(req.user) && req.user.linkedId) {
    const { rows } = await q("SELECT data->>'class' AS c FROM records WHERE collection = 'students' AND id = $1", [req.user.linkedId]);
    klass = rows[0]?.c || null;
  }
  const entries = await Promise.all(COLLECTIONS.map(async (n) => [n, await loadCollection(req.user, n, klass)]));
  res.json(Object.fromEntries(entries));
}));

// Create / update / delete many records of one collection in a single transaction
app.post("/api/data/:name/batch", auth, wrap(async (req, res) => {
  const { name } = req.params;
  if (!COLLECTIONS.includes(name)) return bad(res, "Unknown collection.", 404);
  const { upserts = [], deletes = [] } = req.body || {};
  if (!Array.isArray(upserts) || !Array.isArray(deletes) || upserts.length + deletes.length > 5000) return bad(res, "Invalid batch.");
  const idOk = (id) => typeof id === "string" && /^[\w.:-]{1,80}$/.test(id);
  if (!upserts.every((r) => r && typeof r === "object" && !Array.isArray(r) && idOk(r.id)) || !deletes.every(idOk)) return bad(res, "Invalid record id.");

  try {
    await tx(async (c) => {
      const ids = [...new Set([...upserts.map((r) => r.id), ...deletes])];
      const cur = new Map((await c.query("SELECT id, data FROM records WHERE collection = $1 AND id = ANY($2) FOR UPDATE", [name, ids])).rows.map((r) => [r.id, r.data]));
      if (deletes.length && !canDelete(req.user, name)) throw Object.assign(new Error("You are not allowed to delete these records."), { status: 403 });
      for (const rec of upserts) {
        if (!canWrite(req.user, name, cur.get(rec.id) || null, rec)) throw Object.assign(new Error("You are not allowed to change these records."), { status: 403 });
        await c.query(
          "INSERT INTO records (collection, id, data) VALUES ($1, $2, $3) ON CONFLICT (collection, id) DO UPDATE SET data = EXCLUDED.data, updated_at = now()",
          [name, rec.id, rec]);
      }
      if (deletes.length) await c.query("DELETE FROM records WHERE collection = $1 AND id = ANY($2)", [name, deletes]);
    });
    res.json({ ok: true });
  } catch (e) {
    if (e.code === "23505") return bad(res, "Duplicate value (for example a receipt number). Please refresh and try again.", 409);
    throw e;
  }
}));

/* ---------- User accounts (Admin) ---------- */
app.get("/api/users", auth, adminOnly, wrap(async (_req, res) => {
  const { rows } = await q("SELECT * FROM users ORDER BY created_at");
  res.json(rows.map(publicUser));
}));

const validateUser = (b, creating) => {
  if (creating && !ROLES.includes(b.role)) return "Choose a role.";
  if (!str(b.name)) return "Name is required.";
  if (creating && !/^[a-z0-9._-]{3,40}$/.test(String(b.username || "").trim().toLowerCase())) return "Username: 3–40 letters, numbers, dot, dash or underscore.";
  if ((creating || b.password) && (typeof b.password !== "string" || b.password.length < 8)) return "Password must be at least 8 characters.";
  return null;
};

app.post("/api/users", auth, adminOnly, wrap(async (req, res) => {
  const b = req.body || {}, err = validateUser(b, true);
  if (err) return bad(res, err);
  const id = "usr-" + crypto.randomBytes(5).toString("hex");
  try {
    await q("INSERT INTO users (id, username, role, name, linked_id, password_hash) VALUES ($1,$2,$3,$4,$5,$6)",
      [id, b.username.trim().toLowerCase(), b.role, b.name.trim(), b.role === "Admin" ? null : b.linkedId || null, await bcrypt.hash(b.password, 10)]);
  } catch (e) { if (e.code === "23505") return bad(res, "That username is already taken.", 409); throw e; }
  res.status(201).json({ id });
}));

app.put("/api/users/:id", auth, adminOnly, wrap(async (req, res) => {
  const b = req.body || {}, err = validateUser(b, false);
  if (err) return bad(res, err);
  const { rows } = await q("SELECT * FROM users WHERE id = $1", [req.params.id]);
  if (!rows[0]) return bad(res, "User not found.", 404);
  const hash = b.password ? await bcrypt.hash(b.password, 10) : rows[0].password_hash;
  await q("UPDATE users SET name = $1, linked_id = $2, password_hash = $3 WHERE id = $4",
    [b.name.trim(), rows[0].role === "Admin" ? null : b.linkedId || null, hash, req.params.id]);
  res.json({ ok: true });
}));

app.delete("/api/users/:id", auth, adminOnly, wrap(async (req, res) => {
  if (req.params.id === req.user.id) return bad(res, "You cannot delete your own account.");
  await q("DELETE FROM users WHERE id = $1", [req.params.id]);
  res.json({ ok: true });
}));

/* ---------- Errors ---------- */
app.use((_req, res) => bad(res, "Not found.", 404));
app.use((e, _req, res, _next) => {
  if (e.status) return bad(res, e.message, e.status);
  console.error(e);
  bad(res, "Something went wrong on the server.", 500);
});

// On Vercel the platform runs the exported app itself; locally and on other hosts we start a server.
if (!process.env.VERCEL) app.listen(PORT, () => console.log(`School ERP API listening on :${PORT}`));

export default app;
