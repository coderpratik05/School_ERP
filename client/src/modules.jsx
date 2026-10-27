import { useState } from "react";
import { useApp, Head, Empty, EntityForm, downloadCsv, gradeFor, isKid, attStats, examPct, notify, myNotes } from "./ui.jsx";
import { today, uid } from "./db.js";

const rupee = (n) => "₹" + Number(n || 0).toLocaleString("en-IN");
const sum = (a) => a.reduce((t, x) => t + x, 0);
export const balance = (db, sid, fee) => {
  const e = db.ledger.filter((l) => l.studentId === sid && l.feeId === fee.id);
  const paid = sum(e.filter((l) => l.kind === "paid").map((l) => l.amount)), waived = sum(e.filter((l) => l.kind === "waived").map((l) => l.amount));
  const bal = fee.amount - paid - waived;
  return { paid, waived, bal, status: bal <= 0 ? "Paid" : fee.due < today() ? "Overdue" : paid + waived > 0 ? "Partial" : "Due" };
};
const PILL = { Paid: "Present", Overdue: "Absent", Partial: "Leave", Due: "Leave" };

/* ---------- Parent / student summary ---------- */
export function FamilySummary() {
  const { db, user } = useApp();
  const s = db.students.find((x) => x.id === user.linkedId);
  if (!s) return null;
  const a = attStats(db, s.id);
  const due = sum(db.fees.filter((f) => f.class === s.class).map((f) => Math.max(0, balance(db, s.id, f).bal)));
  const ex = db.exams.filter((e) => e.class === s.class).sort((x, y) => x.date.localeCompare(y.date)).at(-1);
  const ep = ex ? examPct(db, ex, s.id) : null;
  const ev = db.events.filter((e) => e.date >= today()).sort((x, y) => x.date.localeCompare(y.date))[0];
  return (
    <div className="panel"><h3>{s.name} · Class {s.class}</h3>
      <div className="stat-row" style={{ marginBottom: 0 }}>
        <div className="stat-card"><div className="num">{a.pct ?? "—"}{a.pct != null && "%"}</div><div className="label">Attendance</div></div>
        <div className="stat-card"><div className="num">{ep == null ? "—" : ep.toFixed(0) + "%"}</div><div className="label">{ex ? `${ex.name} · grade ${gradeFor(ep)}` : "Latest result"}</div></div>
        <div className="stat-card"><div className="num">{rupee(due)}</div><div className="label">School fees due</div></div>
        <div className="stat-card"><div className="num" style={{ fontSize: 18 }}>{ev ? ev.name : "—"}</div><div className="label">Next event {ev && "· " + ev.date}</div></div>
      </div>
    </div>
  );
}

/* ---------- Academic analytics ---------- */
export function Analytics() {
  const { db } = useApp();
  const classes = [...new Set(db.exams.map((e) => e.class))].sort();
  const [cls, setCls] = useState(classes[0] || "");
  const [eid, setEid] = useState("");
  const exams = db.exams.filter((e) => e.class === cls).sort((a, b) => a.date.localeCompare(b.date));
  const ex = exams.find((e) => e.id === eid) || exams.at(-1);
  const studs = db.students.filter((s) => s.class === cls);
  const subj = ex ? ex.subjects.map((s) => { const m = db.marks.filter((k) => k.examId === ex.id && k.subject === s.name); return { name: s.name, avg: m.length ? Math.round((100 * sum(m.map((k) => k.marks))) / m.length / s.max) : null }; }) : [];
  const ranked = ex ? studs.map((s) => ({ s, p: examPct(db, ex, s.id) })).filter((x) => x.p != null).sort((a, b) => b.p - a.p) : [];
  const terms = exams.map((e) => { const v = studs.map((s) => examPct(db, e, s.id)).filter((x) => x != null); return { e, avg: v.length ? sum(v) / v.length : null }; });
  const falling = studs.map((s) => { const v = exams.map((e) => examPct(db, e, s.id)).filter((x) => x != null); return { s, d: v.length > 1 ? v.at(-1) - v.at(-2) : 0 }; }).filter((x) => x.d <= -5).sort((a, b) => a.d - b.d);
  const Bars = ({ rows }) => rows.map((r) => <div className="bar-row" key={r.k} style={{ gridTemplateColumns: "130px 1fr 48px" }}><b>{r.k}</b><div className="bar"><i style={{ width: (r.v ?? 0) + "%" }} /></div><span className="mono">{r.v == null ? "—" : Math.round(r.v) + "%"}</span></div>);
  return (
    <>
      <Head title="Academic analytics" />
      <div className="panel"><div className="toolbar">
        <select aria-label="Class" value={cls} onChange={(e) => { setCls(e.target.value); setEid(""); }}>{classes.map((c) => <option key={c}>{c}</option>)}</select>
        <select aria-label="Exam" value={ex?.id || ""} onChange={(e) => setEid(e.target.value)}>{exams.map((e) => <option key={e.id} value={e.id}>{e.name} ({e.term})</option>)}</select></div>
        {!ex && <Empty>No exams for this class yet.</Empty>}
      </div>
      {ex && <>
        <div className="dash-grid">
          <div className="panel"><h3>Subject averages</h3><Bars rows={subj.map((s) => ({ k: s.name, v: s.avg }))} /></div>
          <div className="panel"><h3>Class toppers</h3>
            <table className="data"><tbody>{ranked.slice(0, 3).map((x, i) => <tr key={x.s.id}><td className="mono">#{i + 1}</td><td><b>{x.s.name}</b></td><td>{x.p.toFixed(1)}%</td><td>{gradeFor(x.p)}</td></tr>)}</tbody></table>
            {!ranked.length && <Empty>No marks entered.</Empty>}</div>
        </div>
        <div className="dash-grid">
          <div className="panel"><h3>Compare exams & terms (class average)</h3><Bars rows={terms.map((t) => ({ k: `${t.e.name} · ${t.e.term}`, v: t.avg }))} /></div>
          <div className="panel"><h3>Marks declining</h3>
            {falling.length ? <table className="data"><tbody>{falling.map((x) => <tr key={x.s.id}><td><b>{x.s.name}</b></td><td style={{ color: "var(--bad)" }}>{x.d.toFixed(1)} pts vs previous exam</td></tr>)}</tbody></table> : <Empty>No student dropped 5+ points between the last two exams.</Empty>}</div>
        </div>
      </>}
    </>
  );
}

/* ---------- School fees (separate from event fees) ---------- */
const FF = [{ k: "title", l: "Charge (e.g. Tuition — Term 2)", req: 1, full: 1 }, { k: "class", l: "Class", req: 1 }, { k: "amount", l: "Amount (₹)", t: "number", req: 1 }, { k: "due", l: "Due date", t: "date", req: 1 }];
export function Fees() {
  const { db, set, user, toast, ask, upsert } = useApp();
  const admin = user.role === "Admin";
  const [sid, setSid] = useState(isKid(user) ? user.linkedId : db.students[0]?.id);
  const [f, setF] = useState({ feeId: "", amount: "", kind: "paid", note: "" });
  const [rc, setRc] = useState(null);
  const [ed, setEd] = useState();
  const stu = db.students.find((s) => s.id === sid);
  const fees = stu ? db.fees.filter((x) => x.class === stu.class) : [];
  const rows = fees.map((fee) => ({ fee, ...balance(db, sid, fee) }));
  const overdue = db.students.flatMap((s) => db.fees.filter((x) => x.class === s.class && x.due < today()).map((fee) => ({ s, fee, ...balance(db, s.id, fee) })).filter((x) => x.bal > 0));
  const history = db.ledger.filter((l) => l.studentId === sid).sort((a, b) => b.no.localeCompare(a.no));
  const record = (e) => {
    e.preventDefault();
    const fee = fees.find((x) => x.id === f.feeId), amt = Number(f.amount);
    if (amt > balance(db, sid, fee).bal) return toast("Amount is more than the balance for this charge.");
    const rec = { id: uid("rcp"), no: "R-" + String(Math.max(0, ...db.ledger.map((l) => parseInt(String(l.no).slice(2), 10) || 0)) + 1).padStart(4, "0"), studentId: sid, feeId: fee.id, amount: amt, kind: f.kind, note: f.note, date: today() };
    set("ledger", (l) => [...l, rec]);
    notify(set, { id: "pay-" + rec.id, studentId: sid, audience: "family", type: "fee", title: f.kind === "paid" ? "Payment received" : "Concession applied", body: `${rupee(amt)} ${f.kind === "paid" ? "paid" : "waived"} for ${fee.title}. Receipt ${rec.no}.` });
    setF({ feeId: "", amount: "", kind: "paid", note: "" }); toast(f.kind === "paid" ? "Payment recorded." : "Concession applied."); if (f.kind === "paid") setRc(rec);
  };
  return (
    <>
      <Head title="School fees" right="Event fees are managed separately under Events" />
      {admin && <EntityForm title="charge" fields={FF} initial={ed} onSave={(r) => { upsert("fees", { ...r, id: r.id || uid("fee"), amount: Number(r.amount) }); setEd(); toast("Charge saved."); }} onCancel={() => setEd()} />}
      {admin && <div className="panel"><h3>Fee structure</h3><table className="data"><thead><tr><th>Charge</th><th>Class</th><th>Amount</th><th>Due</th><th></th></tr></thead>
        <tbody>{db.fees.map((x) => <tr key={x.id}><td><b>{x.title}</b></td><td>{x.class}</td><td>{rupee(x.amount)}</td><td className="mono">{x.due}</td>
          <td><div className="row-actions"><button className="icon-btn" onClick={() => setEd(x)}>Edit</button><button className="icon-btn del" onClick={() => ask(`Delete "${x.title}" and its ledger entries?`, () => { set("fees", (l) => l.filter((y) => y.id !== x.id)); set("ledger", (l) => l.filter((y) => y.feeId !== x.id)); })}>Delete</button></div></td></tr>)}</tbody></table></div>}
      <div className="panel"><h3>Student ledger</h3>
        {admin && <div className="toolbar"><select aria-label="Student" value={sid} onChange={(e) => { setSid(e.target.value); setRc(null); }}>{db.students.map((s) => <option key={s.id} value={s.id}>{s.name} ({s.class})</option>)}</select></div>}
        <table className="data"><thead><tr><th>Charge</th><th>Due</th><th>Amount</th><th>Concession</th><th>Paid</th><th>Balance</th><th>Status</th></tr></thead>
          <tbody>{rows.length ? rows.map((r) => <tr key={r.fee.id}><td><b>{r.fee.title}</b></td><td className="mono">{r.fee.due}</td><td>{rupee(r.fee.amount)}</td><td>{rupee(r.waived)}</td><td>{rupee(r.paid)}</td><td><b>{rupee(r.bal)}</b></td><td><span className={"status-pill " + PILL[r.status]}>{r.status}</span></td></tr>) : <tr><td colSpan="7"><Empty>No charges set for this class.</Empty></td></tr>}</tbody></table>
        <p className="meta-line">Outstanding: <b>{rupee(sum(rows.map((r) => Math.max(0, r.bal))))}</b></p>
      </div>
      {admin && rows.length > 0 && <div className="panel"><h3>Record payment or concession</h3>
        <form onSubmit={record}><div className="form-grid">
          <div className="field"><label htmlFor="fe-f">Charge</label><select id="fe-f" required value={f.feeId} onChange={(e) => setF({ ...f, feeId: e.target.value, amount: Math.max(0, rows.find((r) => r.fee.id === e.target.value)?.bal || 0) })}><option value="">Choose…</option>{rows.filter((r) => r.bal > 0).map((r) => <option key={r.fee.id} value={r.fee.id}>{r.fee.title} (due {rupee(r.bal)})</option>)}</select></div>
          <div className="field"><label htmlFor="fe-k">Type</label><select id="fe-k" value={f.kind} onChange={(e) => setF({ ...f, kind: e.target.value })}><option value="paid">Payment (partial allowed)</option><option value="waived">Scholarship / concession</option></select></div>
          <div className="field"><label htmlFor="fe-a">Amount (₹)</label><input id="fe-a" type="number" min="1" required value={f.amount} onChange={(e) => setF({ ...f, amount: e.target.value })} /></div>
          <div className="field"><label htmlFor="fe-n">Note</label><input id="fe-n" placeholder="Cash, UPI, scholarship name…" value={f.note} onChange={(e) => setF({ ...f, note: e.target.value })} /></div>
        </div><div className="actions-row"><button className="btn-sm primary">Save</button></div></form></div>}
      <div className="panel"><h3>Payment history</h3>
        <table className="data"><thead><tr><th>Receipt</th><th>Date</th><th>Charge</th><th>Type</th><th>Amount</th><th></th></tr></thead>
          <tbody>{history.length ? history.map((l) => <tr key={l.id}><td className="mono">{l.no}</td><td className="mono">{l.date}</td><td>{db.fees.find((x) => x.id === l.feeId)?.title}</td><td>{l.kind === "paid" ? "Payment" : "Concession"}</td><td>{rupee(l.amount)}</td><td><button className="icon-btn on" onClick={() => setRc(l)}>Receipt</button></td></tr>) : <tr><td colSpan="6"><Empty>No payments yet.</Empty></td></tr>}</tbody></table></div>
      {rc && <><div id="print-area"><div className="report-letterhead"><h2>Government School, Sangola</h2><p>Tal. Sangola, Dist. Solapur, Maharashtra</p><h3>Fee {rc.kind === "paid" ? "Receipt" : "Concession Note"} {rc.no}</h3></div>
        <table className="data report-table"><tbody>
          <tr><td>Student</td><td><b>{db.students.find((s) => s.id === rc.studentId)?.name}</b></td></tr>
          <tr><td>Charge</td><td>{db.fees.find((x) => x.id === rc.feeId)?.title}</td></tr>
          <tr><td>Amount</td><td><b>{rupee(rc.amount)}</b></td></tr><tr><td>Date</td><td>{rc.date}</td></tr><tr><td>Note</td><td>{rc.note || "—"}</td></tr></tbody></table></div>
        <div className="actions-row no-print"><button className="btn-sm primary" onClick={() => window.print()}>Print receipt</button><button className="btn-sm ghost" onClick={() => setRc(null)}>Close</button></div></>}
      {admin && <div className="panel"><h3>Overdue list</h3>
        <div className="toolbar"><button className="btn-sm ghost" onClick={() => downloadCsv([["Student", "Class", "Charge", "Due date", "Balance"], ...overdue.map((o) => [o.s.name, o.s.class, o.fee.title, o.fee.due, o.bal])], "overdue-fees.csv")}>Export CSV</button></div>
        <table className="data"><thead><tr><th>Student</th><th>Charge</th><th>Due</th><th>Balance</th></tr></thead>
          <tbody>{overdue.length ? overdue.map((o) => <tr key={o.s.id + o.fee.id}><td><b>{o.s.name}</b> ({o.s.class})</td><td>{o.fee.title}</td><td className="mono">{o.fee.due}</td><td style={{ color: "var(--bad)" }}>{rupee(o.bal)}</td></tr>) : <tr><td colSpan="4"><Empty>Nothing overdue.</Empty></td></tr>}</tbody></table></div>}
    </>
  );
}

/* ---------- In-app notifications ---------- */
export function Inbox() {
  const { db, set, user } = useApp();
  const [unreadOnly, setUnreadOnly] = useState(false);
  const all = myNotes(db, user).sort((a, b) => b.date.localeCompare(a.date) || b.id.localeCompare(a.id));
  const list = unreadOnly ? all.filter((n) => !n.read) : all;
  const read = (ids) => set("notifications", (l) => l.map((n) => (ids.includes(n.id) ? { ...n, read: true } : n)));
  const icon = { absence: "📍", result: "📝", fee: "💳", alert: "⚠" };
  return (
    <>
      <Head title="Notifications" right={`${all.filter((n) => !n.read).length} unread`} />
      <div className="panel">
        <div className="toolbar"><label className="mono"><input type="checkbox" checked={unreadOnly} onChange={(e) => setUnreadOnly(e.target.checked)} /> Unread only</label>
          <button className="btn-sm ghost" onClick={() => read(all.map((n) => n.id))}>Mark all read</button></div>
        {list.length ? list.map((n) => (
          <div key={n.id} className={"fb-item" + (n.read ? "" : " unread")} style={n.read ? { opacity: 0.65 } : undefined}>
            <div><b>{icon[n.type] || "🔔"} {n.title}</b> <span className="mono">{n.date}{!isKid(user) && ` · ${db.students.find((s) => s.id === n.studentId)?.name || ""}`}</span><p className="notice-body">{n.body}</p></div>
            {!n.read && <button className="icon-btn on" onClick={() => read([n.id])}>Mark read</button>}
          </div>
        )) : <Empty>{all.length ? "You're all caught up." : "No notifications yet. Absences, results and fee updates appear here."}</Empty>}
      </div>
    </>
  );
}
