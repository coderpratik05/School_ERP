import { useEffect, useState } from "react";
import { api } from "./api.js";
import { Head, Empty, useApp } from "./ui.jsx";

const ROLES = ["Admin", "Teacher", "Student", "Parent"];
const blank = { role: "Teacher", name: "", username: "", password: "", linkedId: "" };

/* ---------- Admin: manage login accounts ---------- */
export function Users() {
  const { db, user, toast, ask } = useApp();
  const [list, setList] = useState(null);
  const [f, setF] = useState(blank);
  const [ed, setEd] = useState(null); // account being edited
  const [busy, setBusy] = useState(false);
  const load = () => api.users().then(setList).catch((e) => toast(e.message));
  useEffect(() => { load(); }, []);

  const linkables = f.role === "Teacher" ? db.staff.map((s) => ({ id: s.id, label: `${s.name} (${s.subject})` }))
    : f.role === "Admin" ? [] : db.students.map((s) => ({ id: s.id, label: `${s.name} (${s.class}, roll ${s.roll})` }));
  const nameOf = (u) => (u.role === "Teacher" ? db.staff : db.students).find((x) => x.id === u.linkedId)?.name;
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });

  const submit = async (e) => {
    e.preventDefault(); setBusy(true);
    try {
      if (ed) await api.updateUser(ed.id, { name: f.name, linkedId: f.linkedId, password: f.password || undefined });
      else await api.createUser(f);
      toast(ed ? "Account updated." : "Account created.");
      setF(blank); setEd(null); await load();
    } catch (x) { toast(x.message); }
    setBusy(false);
  };
  const edit = (u) => { setEd(u); setF({ role: u.role, name: u.name, username: u.username, password: "", linkedId: u.linkedId || "" }); window.scrollTo({ top: 0, behavior: "smooth" }); };
  const remove = (u) => ask(`Delete the account "${u.username}"?`, async () => {
    try { await api.deleteUser(u.id); toast("Account deleted."); load(); } catch (x) { toast(x.message); }
  });

  return (
    <>
      <Head title="Login accounts" right="Who can sign in" />
      <div className="panel">
        <h3>{ed ? "Edit" : "Create"} account</h3>
        <form onSubmit={submit}>
          <div className="form-grid">
            <div className="field"><label htmlFor="u-role">Role</label>
              <select id="u-role" value={f.role} disabled={!!ed} onChange={(e) => setF({ ...f, role: e.target.value, linkedId: "" })}>{ROLES.map((r) => <option key={r}>{r}</option>)}</select></div>
            <div className="field"><label htmlFor="u-name">Full name</label><input id="u-name" required value={f.name} onChange={set("name")} /></div>
            <div className="field"><label htmlFor="u-user">Username</label><input id="u-user" required disabled={!!ed} autoComplete="off" value={f.username} onChange={set("username")} /></div>
            <div className="field"><label htmlFor="u-pw">{ed ? "New password (leave empty to keep)" : "Password (min 8 characters)"}</label>
              <input id="u-pw" type="password" autoComplete="new-password" required={!ed} minLength={8} value={f.password} onChange={set("password")} /></div>
            {f.role !== "Admin" && <div className="field full"><label htmlFor="u-link">{f.role === "Teacher" ? "Linked staff member" : "Linked student"}</label>
              <select id="u-link" required value={f.linkedId} onChange={set("linkedId")}><option value="">— choose —</option>{linkables.map((x) => <option key={x.id} value={x.id}>{x.label}</option>)}</select></div>}
          </div>
          <div className="actions-row">
            <button className="btn-sm primary" disabled={busy}>{ed ? "Save changes" : "Create account"}</button>
            {ed && <button type="button" className="btn-sm ghost" onClick={() => { setEd(null); setF(blank); }}>Cancel edit</button>}
          </div>
        </form>
      </div>
      <div className="panel"><h3>All accounts</h3>
        {!list ? <Empty>Loading…</Empty> : (
          <table className="data"><thead><tr><th>Name</th><th>Username</th><th>Role</th><th>Linked to</th><th></th></tr></thead>
            <tbody>{list.map((u) => (
              <tr key={u.id}><td><b>{u.name}</b></td><td className="mono">{u.username}</td><td><span className="role-pill">{u.role}</span></td><td>{nameOf(u) || "—"}</td>
                <td><div className="row-actions"><button className="icon-btn" onClick={() => edit(u)}>Edit</button>
                  {u.id !== user.id && <button className="icon-btn del" onClick={() => remove(u)}>Delete</button>}</div></td></tr>))}</tbody></table>)}
      </div>
    </>
  );
}

/* ---------- Everyone: change own password ---------- */
export function Account() {
  const { user, toast } = useApp();
  const [f, setF] = useState({ current: "", next: "", again: "" });
  const [err, setErr] = useState("");
  const submit = async (e) => {
    e.preventDefault();
    if (f.next !== f.again) return setErr("The new passwords do not match.");
    try { await api.changePassword(f.current, f.next); setF({ current: "", next: "", again: "" }); setErr(""); toast("Password changed."); }
    catch (x) { setErr(x.message); }
  };
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  return (
    <>
      <Head title="My password" right={`${user.name} · ${user.role}`} />
      <div className="panel"><h3>Change password</h3>
        <form onSubmit={submit}>
          <div className="form-grid">
            <div className="field full"><label htmlFor="p-cur">Current password</label><input id="p-cur" type="password" autoComplete="current-password" required value={f.current} onChange={set("current")} /></div>
            <div className="field"><label htmlFor="p-new">New password (min 8 characters)</label><input id="p-new" type="password" autoComplete="new-password" required minLength={8} value={f.next} onChange={set("next")} /></div>
            <div className="field"><label htmlFor="p-again">Repeat new password</label><input id="p-again" type="password" autoComplete="new-password" required value={f.again} onChange={set("again")} /></div>
          </div>
          {err && <p className="login-error">{err}</p>}
          <div className="actions-row"><button className="btn-sm primary">Change password</button></div>
        </form>
      </div>
    </>
  );
}
