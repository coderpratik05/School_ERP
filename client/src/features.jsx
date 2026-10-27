import { useEffect, useRef, useState } from "react";
import { useApp, Head, Empty, EntityForm, Stars, gradeFor, downloadCsv, REMARK } from "./ui.jsx";
import { today, uid } from "./db.js";

const rupee = (n) => "₹" + Number(n || 0).toLocaleString("en-IN");

/* ---------- Events & fees ---------- */
const EF = [{ k: "name", l: "Event name", req: 1, full: 1 }, { k: "date", l: "Date", t: "date", req: 1 }, { k: "fee", l: "Fee per student (₹)", t: "number", req: 1 }, { k: "description", l: "Description", full: 1 }];
export function Events() {
  const { db, set, user, toast, ask, upsert } = useApp();
  const admin = user.role === "Admin";
  const [ed, setEd] = useState();
  const [pay, setPay] = useState({ eventId: "", studentId: "", amount: "" });
  const mine = (p) => admin || user.role === "Teacher" || p.studentId === user.linkedId;
  const save = (r) => { upsert("events", { ...r, id: r.id || uid("evt"), fee: Number(r.fee) }); setEd(); toast("Event saved."); };
  const record = (e) => {
    e.preventDefault();
    set("payments", (l) => [...l, { id: uid("pmt"), ...pay, amount: Number(pay.amount), date: today() }]);
    setPay({ eventId: "", studentId: "", amount: "" }); toast("Payment recorded.");
  };
  return (
    <>
      <Head title="Events & fees" />
      {admin && <EntityForm title="event" fields={EF} initial={ed} onSave={save} onCancel={() => setEd()} />}
      <div className="event-grid">
        {db.events.map((ev) => {
          const paid = db.payments.filter((p) => p.eventId === ev.id).reduce((a, p) => a + p.amount, 0);
          const due = ev.fee * db.students.length, pct = due ? Math.min(100, Math.round((100 * paid) / due)) : 100;
          return (
            <div className="panel event-card" key={ev.id}>
              <span className="mono">{ev.date}</span><h3 style={{ border: 0, padding: 0, margin: "2px 0 6px" }}>{ev.name}</h3>
              <p className="notice-body">{ev.description}</p>
              <div className="bar"><i style={{ width: pct + "%" }} /></div>
              <p className="meta-line">{ev.fee ? <>Fee {rupee(ev.fee)} · collected <b>{rupee(paid)}</b> of {rupee(due)} ({pct}%)</> : "Free event"}</p>
              {admin && <div className="row-actions"><button className="icon-btn" onClick={() => setEd(ev)}>Edit</button><button className="icon-btn del" onClick={() => ask(`Delete ${ev.name} and its payments?`, () => { set("events", (l) => l.filter((x) => x.id !== ev.id)); set("payments", (l) => l.filter((x) => x.eventId !== ev.id)); })}>Delete</button></div>}
            </div>
          );
        })}
      </div>
      {admin && (
        <div className="panel"><h3>Record a payment</h3>
          <form onSubmit={record}><div className="form-grid">
            <div className="field"><label htmlFor="p-e">Event</label><select id="p-e" required value={pay.eventId} onChange={(e) => setPay({ ...pay, eventId: e.target.value, amount: db.events.find((x) => x.id === e.target.value)?.fee ?? "" })}><option value="">Choose…</option>{db.events.filter((x) => x.fee > 0).map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}</select></div>
            <div className="field"><label htmlFor="p-s">Student</label><select id="p-s" required value={pay.studentId} onChange={(e) => setPay({ ...pay, studentId: e.target.value })}><option value="">Choose…</option>{db.students.map((x) => <option key={x.id} value={x.id}>{x.name} ({x.class})</option>)}</select></div>
            <div className="field"><label htmlFor="p-a">Amount (₹)</label><input id="p-a" type="number" min="1" required value={pay.amount} onChange={(e) => setPay({ ...pay, amount: e.target.value })} /></div>
          </div><div className="actions-row"><button className="btn-sm primary">Record payment</button></div></form>
        </div>
      )}
      <div className="panel"><h3>{admin ? "Payments" : "My payments"}</h3>
        <table className="data"><thead><tr><th>Event</th><th>Student</th><th>Amount</th><th>Date</th><th></th></tr></thead>
          <tbody>{db.payments.filter(mine).length ? db.payments.filter(mine).map((p) => (
            <tr key={p.id}><td>{db.events.find((e) => e.id === p.eventId)?.name || "—"}</td><td>{db.students.find((s) => s.id === p.studentId)?.name || "—"}</td><td>{rupee(p.amount)}</td><td className="mono">{p.date}</td>
              <td>{admin && <button className="icon-btn del" onClick={() => ask("Remove this payment?", () => set("payments", (l) => l.filter((x) => x.id !== p.id)))}>Remove</button>}</td></tr>
          )) : <tr><td colSpan="5"><Empty>No payments recorded yet.</Empty></td></tr>}</tbody></table>
      </div>
    </>
  );
}

/* ---------- Feedback ---------- */
const CATS = ["Teaching", "Facilities", "Administration", "Student support", "General"];
export function Feedback() {
  const { db, set, user, toast, ask } = useApp();
  const [f, setF] = useState({ category: CATS[0], rating: 0, comments: "" });
  const list = db.feedback.filter((x) => user.role === "Admin" || x.userId === user.id).sort((a, b) => b.date.localeCompare(a.date));
  const avg = list.length ? (list.reduce((a, x) => a + x.rating, 0) / list.length).toFixed(1) : "—";
  const submit = (e) => {
    e.preventDefault();
    if (!f.rating) return toast("Pick a star rating first.");
    set("feedback", (l) => [...l, { id: uid("fb"), userId: user.id, by: user.name, role: user.role, date: today(), ...f }]);
    setF({ category: CATS[0], rating: 0, comments: "" }); toast("Thanks — feedback submitted.");
  };
  return (
    <>
      <Head title="Feedback" right={`Average rating ${avg}`} />
      <div className="panel"><h3>Share feedback</h3>
        <form onSubmit={submit}>
          <div className="form-grid">
            <div className="field"><label htmlFor="fb-c">Topic</label><select id="fb-c" value={f.category} onChange={(e) => setF({ ...f, category: e.target.value })}>{CATS.map((c) => <option key={c}>{c}</option>)}</select></div>
            <div className="field"><label>Rating</label><Stars value={f.rating} onChange={(rating) => setF({ ...f, rating })} /></div>
            <div className="field full"><label htmlFor="fb-t">Comments</label><input id="fb-t" value={f.comments} onChange={(e) => setF({ ...f, comments: e.target.value })} /></div>
          </div>
          <div className="actions-row"><button className="btn-sm primary">Submit feedback</button></div>
        </form>
      </div>
      <div className="panel"><h3>{user.role === "Admin" ? "All feedback" : "My feedback"}</h3>
        {list.length ? list.map((x) => (
          <div className="fb-item" key={x.id}><div><Stars value={x.rating} /> <b>{x.category}</b> <span className="mono">{x.by} · {x.date}</span><p className="notice-body">{x.comments || "No comment."}</p></div>
            {user.role === "Admin" && <button className="icon-btn del" onClick={() => ask("Remove this feedback?", () => set("feedback", (l) => l.filter((y) => y.id !== x.id)))}>Remove</button>}</div>
        )) : <Empty>No feedback yet.</Empty>}
      </div>
    </>
  );
}

/* ---------- Printable reports ---------- */
export function Reports() {
  const { db, set, user } = useApp();
  const classes = [...new Set(db.students.map((s) => s.class))].sort();
  const [type, setType] = useState("class");
  const [cls, setCls] = useState(classes[0] || "");
  const [stu, setStu] = useState(db.students[0]?.id || "");
  const [exm, setExm] = useState(db.exams[0]?.id || "");
  const students = db.students.filter((s) => s.class === cls);
  const att = (id) => { const r = db.attendance.filter((a) => a.studentId === id); return r.length ? Math.round((100 * r.filter((a) => a.status === "Present").length) / r.length) : null; };
  const student = db.students.find((s) => s.id === stu), exam = db.exams.find((e) => e.id === exm);
  const rows = exam && student ? exam.subjects.map((s) => ({ ...s, got: db.marks.find((m) => m.examId === exam.id && m.studentId === student.id && m.subject === s.name)?.marks })) : [];
  const total = rows.reduce((a, r) => a + (r.got || 0), 0), max = rows.reduce((a, r) => a + r.max, 0);
  return (
    <>
      <Head title="Reports" />
      <div className="panel no-print"><h3>Generate a report</h3>
        <div className="form-grid">
          <div className="field"><label htmlFor="r-t">Report</label><select id="r-t" value={type} onChange={(e) => setType(e.target.value)}><option value="class">Class list with attendance</option><option value="card">Report card</option></select></div>
          {type === "class" && <div className="field"><label htmlFor="r-c">Class</label><select id="r-c" value={cls} onChange={(e) => setCls(e.target.value)}>{classes.map((c) => <option key={c}>{c}</option>)}</select></div>}
          {type === "card" && <><div className="field"><label htmlFor="r-s">Student</label><select id="r-s" value={stu} onChange={(e) => setStu(e.target.value)}>{db.students.map((s) => <option key={s.id} value={s.id}>{s.name} ({s.class})</option>)}</select></div>
            <div className="field"><label htmlFor="r-e">Exam</label><select id="r-e" value={exm} onChange={(e) => setExm(e.target.value)}>{db.exams.map((x) => <option key={x.id} value={x.id}>{x.name} — {x.class}</option>)}</select></div></>}
        </div>
        <div className="actions-row"><button className="btn-sm primary" onClick={() => window.print()}>Print / save as PDF</button>
          {type === "class" && <button className="btn-sm ghost" onClick={() => downloadCsv([["Roll", "Name", "Gender", "Attendance %"], ...students.map((s) => [s.roll, s.name, s.gender, att(s.id) ?? ""])], `class-${cls}.csv`)}>Export CSV</button>}</div>
      </div>
      {type === "card" && user.role !== "Student" && user.role !== "Parent" && (
        <div className="panel no-print"><div className="field"><label htmlFor="r-cm">Teacher's comment</label><input id="r-cm" value={db.comments.find((c) => c.id === exm + "-" + stu)?.text || ""} onChange={(e) => set("comments", (l) => [...l.filter((c) => c.id !== exm + "-" + stu), { id: exm + "-" + stu, text: e.target.value }])} /></div></div>
      )}
      <div id="print-area">
        <div className="report-letterhead"><h2>Government School, Sangola</h2><p>Tal. Sangola, Dist. Solapur, Maharashtra</p><h3>{type === "class" ? `Class list — ${cls}` : "Report card"}</h3></div>
        {type === "class" ? (
          <table className="data report-table"><thead><tr><th>Roll</th><th>Name</th><th>Gender</th><th>Attendance</th></tr></thead>
            <tbody>{students.map((s) => <tr key={s.id}><td className="mono">{s.roll || "—"}</td><td><b>{s.name}</b></td><td>{s.gender}</td><td>{att(s.id) == null ? "—" : att(s.id) + "%"}</td></tr>)}</tbody></table>
        ) : exam && student ? (
          <>
            <p className="report-meta"><b>{student.name}</b> · Class {student.class} · {exam.name} ({exam.term})</p>
            <table className="data report-table"><thead><tr><th>Subject</th><th>Marks</th><th>Max</th></tr></thead>
              <tbody>{rows.map((r) => <tr key={r.name}><td>{r.name}</td><td className="mono">{r.got ?? "—"}</td><td className="mono">{r.max}</td></tr>)}</tbody></table>
            <p className="report-meta"><b>Total</b> {total}/{max} · <b>{max ? ((total / max) * 100).toFixed(1) : 0}%</b> · Grade <b>{gradeFor(max ? (total / max) * 100 : null)}</b></p>
            <p className="report-meta"><b>Remark:</b> {REMARK[gradeFor(max ? (total / max) * 100 : null)] || "—"}</p>
            <p className="report-meta"><b>Teacher's comment:</b> {db.comments.find((c) => c.id === exm + "-" + stu)?.text || "—"}</p>
          </>
        ) : <Empty>Choose a student and an exam.</Empty>}
      </div>
    </>
  );
}

/* ---------- Command palette (Ctrl/⌘ + K) ---------- */
export function Palette({ nav, db, go, onClose }) {
  const [q, setQ] = useState("");
  const [i, setI] = useState(0);
  const ref = useRef();
  useEffect(() => ref.current?.focus(), []);
  const s = q.trim().toLowerCase();
  const items = [
    ...nav.map((n) => ({ key: n.id, label: n.label, hint: "Go to page", tab: n.id })),
    ...(nav.some((n) => n.id === "students") ? db.students.map((x) => ({ key: x.id, label: x.name, hint: `Student · ${x.class}`, tab: "students" })) : []),
    ...(nav.some((n) => n.id === "staff") ? db.staff.map((x) => ({ key: x.id, label: x.name, hint: `Staff · ${x.subject}`, tab: "staff" })) : []),
  ].filter((x) => !s || x.label.toLowerCase().includes(s)).slice(0, 8);
  const pick = (x) => { if (x) { go(x.tab); onClose(); } };
  const keys = (e) => {
    if (e.key === "Escape") onClose();
    else if (e.key === "ArrowDown") { e.preventDefault(); setI((i + 1) % Math.max(items.length, 1)); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setI((i + items.length - 1) % Math.max(items.length, 1)); }
    else if (e.key === "Enter") pick(items[i]);
  };
  return (
    <div className="modal-back" onClick={onClose}>
      <div className="modal palette" role="dialog" aria-label="Quick search" onClick={(e) => e.stopPropagation()}>
        <input ref={ref} value={q} placeholder="Search pages, students, staff…" onChange={(e) => { setQ(e.target.value); setI(0); }} onKeyDown={keys} />
        <ul>{items.length ? items.map((x, n) => <li key={x.key} className={n === i ? "sel" : ""} onMouseEnter={() => setI(n)} onClick={() => pick(x)}><b>{x.label}</b><span className="mono">{x.hint}</span></li>) : <li className="mono">No matches.</li>}</ul>
      </div>
    </div>
  );
}
