import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Ctx, Icon, isKid, myNotes } from "./ui.jsx";
import { Analytics, Fees, Inbox } from "./modules.jsx";
import { api, getToken, setToken, setUnauthorizedHandler, queueSave } from "./api.js";
import { Events, Feedback, Reports, Palette } from "./features.jsx";
import { Dashboard, Students, Attendance, Staff, Exams, Timetable, Notices, Data } from "./pages.jsx";
import { Users, Account } from "./users.jsx";

const NAV = [
  { id: "dashboard", label: "Dashboard", C: Dashboard, roles: ["Admin", "Teacher", "Student", "Parent"] },
  { id: "students", label: "Students", C: Students, roles: ["Admin", "Teacher"] },
  { id: "attendance", label: "Attendance", C: Attendance, roles: ["Admin", "Teacher", "Student", "Parent"] },
  { id: "staff", label: "Staff", C: Staff, roles: ["Admin"] },
  { id: "exams", label: "Exams & Grades", C: Exams, roles: ["Admin", "Teacher", "Student", "Parent"] },
  { id: "timetable", label: "Timetable", C: Timetable, roles: ["Admin", "Teacher", "Student", "Parent"] },
  { id: "notices", label: "Notices", C: Notices, roles: ["Admin", "Teacher", "Student", "Parent"] },
  { id: "events", label: "Events & Fees", C: Events, roles: ["Admin", "Teacher", "Student", "Parent"] },
  { id: "reports", label: "Reports", C: Reports, roles: ["Admin", "Teacher"] },
  { id: "feedback", label: "Feedback", C: Feedback, roles: ["Admin", "Teacher", "Student", "Parent"] },
  { id: "analytics", label: "Analytics", C: Analytics, roles: ["Admin", "Teacher"] },
  { id: "fees", label: "School Fees", C: Fees, roles: ["Admin", "Student", "Parent"] },
  { id: "inbox", label: "Notifications", C: Inbox, roles: ["Admin", "Teacher", "Student", "Parent"] },
  { id: "account", label: "My password", C: Account, roles: ["Admin", "Teacher", "Student", "Parent"] },
  { id: "users", label: "Accounts", C: Users, roles: ["Admin"] },
  { id: "data", label: "Data", C: Data, roles: ["Admin"] },
];

const ROLES = ["Admin", "Teacher", "Student", "Parent"];
const initials = (n) => n.split(/\s+/).map((w) => w[0]).slice(0, 2).join("").toUpperCase();

function Login({ onLogin }) {
  const [f, setF] = useState({ role: "Admin", username: "", password: "" });
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const [show, setShow] = useState(false);
  const submit = async (e) => {
    e.preventDefault();
    setBusy(true); setErr("");
    try {
      const { token, user } = await api.login(f.role, f.username.trim().toLowerCase(), f.password);
      setToken(token);
      await onLogin(user);
    } catch (x) { setErr(x.message); setBusy(false); }
  };
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  return (
    <div className="login-wrap">
      <div className="login-split">
        <aside className="login-board">
          <span className="login-logo">GS</span>
          <div className="board-copy">
            <h2>Government School<br />Sangola</h2>
            <svg className="chalk-line" viewBox="0 0 220 12" aria-hidden="true"><path d="M2 8 C 30 2, 60 11, 95 6 S 160 3, 218 7" /></svg>
            <p>Attendance, marks, fees and notices — in one place for staff, students and parents.</p>
          </div>
        </aside>
        <div className="login-card">
          <h1>Sign in</h1>
          <p className="sub">Use the username and password your school gave you.</p>
          <form onSubmit={submit}>
            <div className="field">
              <span className="lbl" id="l-role-l">Sign in as</span>
              <div className="role-chips" role="radiogroup" aria-labelledby="l-role-l">
                {ROLES.map((r) => <button type="button" key={r} role="radio" aria-checked={f.role === r} onClick={() => setF({ ...f, role: r })}>{r}</button>)}
              </div>
            </div>
            <div className="field"><label htmlFor="l-user">Username</label><input id="l-user" autoComplete="username" autoCapitalize="none" required value={f.username} onChange={set("username")} /></div>
            <div className="field"><label htmlFor="l-pw">Password</label>
              <div className="pw-wrap"><input id="l-pw" type={show ? "text" : "password"} autoComplete="current-password" required value={f.password} onChange={set("password")} />
                <button type="button" onClick={() => setShow(!show)} aria-pressed={show}>{show ? "Hide" : "Show"}</button></div></div>
            <p className="login-error" role="alert">{err}</p>
            <button className="btn-primary" disabled={busy}>{busy ? "Signing in…" : "Sign in"}</button>
          </form>
        </div>
      </div>
    </div>
  );
}

const Splash = ({ children }) => <div className="login-wrap"><p style={{ color: "var(--text-soft)" }}>{children}</p></div>;

export default function App() {
  const [db, setDb] = useState(null);
  const dbRef = useRef(null);           // always holds the latest data
  const [user, setUser] = useState(null);
  const [booting, setBooting] = useState(!!getToken());
  const [loadErr, setLoadErr] = useState("");
  const [tab, setTab] = useState("dashboard");
  const [msg, setMsg] = useState("");
  const [dlg, setDlg] = useState(null);
  const [pal, setPal] = useState(false);
  const [dark, setDark] = useState(() => localStorage.getItem("erp_theme") === "dark");
  useEffect(() => { document.documentElement.dataset.theme = dark ? "dark" : "light"; localStorage.setItem("erp_theme", dark ? "dark" : "light"); }, [dark]);
  useEffect(() => {
    const k = (e) => { if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") { e.preventDefault(); setPal((p) => !p); } };
    window.addEventListener("keydown", k); return () => window.removeEventListener("keydown", k);
  }, []);
  useEffect(() => { if (!msg) return; const t = setTimeout(() => setMsg(""), 2400); return () => clearTimeout(t); }, [msg]);

  const reload = useCallback(async () => {
    const d = await api.loadAll();
    dbRef.current = d; setDb(d);
  }, []);
  const logout = useCallback(() => { setToken(null); dbRef.current = null; setDb(null); setUser(null); setBooting(false); }, []);
  useEffect(() => { setUnauthorizedHandler(logout); }, [logout]);

  // Restore an existing session after a page refresh
  useEffect(() => {
    if (!getToken()) return;
    api.me().then(async ({ user: u }) => { await reload(); setUser(u); setTab(isKid(u) ? "attendance" : "dashboard"); })
      .catch((e) => { if (e.message.startsWith("Cannot reach")) setLoadErr(e.message); else logout(); })
      .finally(() => setBooting(false));
  }, [reload, logout]);

  const login = async (u) => { await reload(); setUser(u); setTab(isKid(u) ? "attendance" : "dashboard"); };

  // Change a collection locally (instant) and save the difference to the server
  const set = useCallback((name, fn) => {
    const before = dbRef.current[name], after = fn(before);
    dbRef.current = { ...dbRef.current, [name]: after };
    setDb(dbRef.current);
    queueSave(name, before, after, (e) => { setMsg("Could not save: " + e.message); reload().catch(() => {}); });
  }, [reload]);
  const upsert = useCallback((name, rec) => set(name, (l) => (l.some((x) => x.id === rec.id) ? l.map((x) => (x.id === rec.id ? rec : x)) : [...l, rec])), [set]);
  const ctx = useMemo(() => ({ db, set, upsert, user, reload, toast: setMsg, ask: (text, yes) => setDlg({ text, yes }) }), [db, set, upsert, user, reload]);

  if (loadErr) return <Splash>{loadErr} <button className="btn-sm primary" onClick={() => location.reload()}>Retry</button></Splash>;
  if (booting) return <Splash>Loading…</Splash>;
  if (!user) return <Login onLogin={login} />;
  if (!db) return <Splash>Loading…</Splash>;

  const nav = NAV.filter((n) => n.roles.includes(user.role));
  const unread = myNotes(db, user).filter((n) => !n.read).length;
  const Page = (nav.find((n) => n.id === tab) || nav[0]).C;
  return (
    <Ctx.Provider value={ctx}>
      <div className="app-shell active">
        <aside className="sidebar">
          <div className="brand"><span className="brand-mark">GS</span><div><h2>Government School</h2><span className="brand-sub">Sangola</span></div></div>
          <nav aria-label="Main">{nav.map((n) => (
            <button key={n.id} className={"tab-btn" + (n.id === tab ? " active" : "")} aria-current={n.id === tab ? "page" : undefined} onClick={() => setTab(n.id)}>
              <Icon n={n.id} /><span>{n.label}</span>{n.id === "inbox" && unread > 0 && <span className="tab-count">{unread}</span>}
            </button>))}</nav>
          <div className="sidebar-footer">
            <div className="who"><span className="avatar">{initials(user.name)}</span><div><b>{user.name}</b><span className="role-pill">{user.role}</span></div></div>
            <div className="foot-actions">
              <button className="logout-btn search-btn" onClick={() => setPal(true)} title="Ctrl + K">Search</button>
              <button className="logout-btn" onClick={() => setDark(!dark)}>{dark ? "Light" : "Dark"}</button>
            </div>
            <button className="logout-btn" onClick={logout}>Sign out</button>
          </div>
        </aside>
        <main className="main"><section className="view active" key={tab}><Page /></section></main>
      </div>
      <div className={"toast" + (msg ? " show" : "")} role="status">{msg}</div>
      {pal && <Palette nav={nav} db={db} go={setTab} onClose={() => setPal(false)} />}
      {dlg && (
        <div className="modal-back" onClick={() => setDlg(null)}>
          <div className="modal" role="alertdialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>
            <p>{dlg.text}</p>
            <div className="actions-row"><button className="btn-sm danger" autoFocus onClick={() => { dlg.yes(); setDlg(null); }}>Confirm</button><button className="btn-sm ghost" onClick={() => setDlg(null)}>Cancel</button></div>
          </div>
        </div>
      )}
    </Ctx.Provider>
  );
}
