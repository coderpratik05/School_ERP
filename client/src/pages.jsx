import { useEffect, useState } from "react";
import { useApp, Head, Empty, EntityForm, gradeFor, CountUp, downloadCsv, isKid, attStats, repeatedAbsent, notify } from "./ui.jsx";
import { today, uid } from "./db.js";
import { FamilySummary } from "./modules.jsx";

const classesOf = (db) => [...new Set(db.students.map((s) => s.class))].sort();
const isStaff = (u) => u.role === "Admin" || u.role === "Teacher";

/* ---------- Dashboard ---------- */
const greet = (u) => {
  const h = new Date().getHours();
  return `${h < 12 ? "Good morning" : h < 17 ? "Good afternoon" : "Good evening"}, ${u.role === "Admin" ? u.name : u.name.split(" ")[0]}`;
};
export function Dashboard() {
  const { db, user } = useApp();
  const alerts = isStaff(user) ? repeatedAbsent(db) : [];
  const dates = [...new Set(db.attendance.map((a) => a.date))].sort();
  const d = dates.includes(today()) ? today() : dates.at(-1);
  const day = db.attendance.filter((a) => a.date === d);
  const present = day.filter((a) => a.status === "Present").length;
  const rate = (c) => {
    const ids = db.students.filter((s) => s.class === c).map((s) => s.id);
    const r = day.filter((a) => ids.includes(a.studentId));
    return r.length ? Math.round((100 * r.filter((a) => a.status === "Present").length) / r.length) : null;
  };
  const trend = dates.slice(-7).map((x) => { const r = db.attendance.filter((a) => a.date === x); return { x, p: Math.round((100 * r.filter((a) => a.status === "Present").length) / r.length) }; });
  const pts = trend.map((t, i) => [trend.length > 1 ? (i * 300) / (trend.length - 1) : 150, 100 - t.p]);
  const line = pts.map((q) => q.join(",")).join(" ");
  const upcoming = db.events.filter((e) => e.date >= today()).sort((a, b) => a.date.localeCompare(b.date)).slice(0, 3);
  const notices = db.notices.filter((n) => !n.expiry || n.expiry >= today()).sort((a, b) => b.date.localeCompare(a.date)).slice(0, 3);
  return (
    <>
      <Head title={greet(user)} right={new Date().toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" })} />
      {isKid(user) && <FamilySummary />}
      {alerts.length > 0 && <div className="panel alert-panel"><h3>⚠ Repeated absences</h3><p className="notice-body">{alerts.map((a) => `${a.s.name} (${a.s.class}) — ${a.n} of last 5 days`).join(" · ")}. Open Attendance to notify families.</p></div>}
      <div className="stat-row">
        <div className="stat-card"><div className="num"><CountUp to={db.students.length} /></div><div className="label">Students</div></div>
        <div className="stat-card"><div className="num"><CountUp to={db.staff.length} /></div><div className="label">Staff members</div></div>
        <div className="stat-card"><div className="num">{day.length ? `${present}/${day.length}` : "—"}</div><div className="label">Present {d === today() ? "today" : d ? "on " + d : ""}</div></div>
      </div>
      <div className="dash-grid">
      <div className="panel">
        <h3>Attendance trend (last {trend.length} days)</h3>
        {trend.length > 1 ? (
          <svg viewBox="-10 -8 320 124" className="trend" role="img" aria-label="Attendance percentage trend">
            <defs><linearGradient id="tg" x1="0" y1="0" x2="0" y2="1"><stop className="trend-stop" offset="0" stopOpacity=".28" /><stop className="trend-stop" offset="1" stopOpacity="0" /></linearGradient></defs>
            <polygon points={`0,100 ${line} 300,100`} fill="url(#tg)" />
            <polyline className="trend-line" points={line} />
            {pts.map((q, i) => <g key={i}><circle className="trend-dot" cx={q[0]} cy={q[1]} r="4"><title>{trend[i].x}: {trend[i].p}%</title></circle><text className="trend-label" x={q[0]} y="114">{trend[i].x.slice(5)}</text></g>)}
          </svg>
        ) : <Empty>Mark attendance on a few days to see a trend.</Empty>}
      </div>
      <div className="panel">
        <h3>Upcoming events</h3>
        <ul className="notice-mini-list">{upcoming.length ? upcoming.map((e) => <li key={e.id}><b>{e.name}</b> <span className="mono">{e.date}</span></li>) : <li className="mono">Nothing scheduled.</li>}</ul>
      </div>
      </div>
      <div className="panel">
        <h3>Attendance by class</h3>
        {day.length ? classesOf(db).map((c) => (
          <div className="bar-row" key={c}><b>{c}</b><div className="bar"><i style={{ width: (rate(c) ?? 0) + "%" }} /></div><span className="mono">{rate(c) ?? "—"}%</span></div>
        )) : <Empty>No attendance has been marked yet.</Empty>}
      </div>
      <div className="panel">
        <h3>Latest notices</h3>
        <ul className="notice-mini-list">
          {notices.length ? notices.map((n) => <li key={n.id}><b>{n.title}</b> <span className="mono">{n.date}</span></li>) : <li className="mono">No active notices.</li>}
        </ul>
      </div>
    </>
  );
}

/* ---------- Students ---------- */
const SF = [
  { k: "name", l: "Full name", req: 1 }, { k: "class", l: "Class", req: 1 }, { k: "roll", l: "Roll no." },
  { k: "gender", l: "Gender", opts: ["Male", "Female", "Other"] }, { k: "dob", l: "Date of birth", t: "date" },
  { k: "parent", l: "Parent / guardian" }, { k: "contact", l: "Contact number" }, { k: "address", l: "Address", full: 1 },
];
export function Students() {
  const { db, set, user, toast, ask, upsert } = useApp();
  const [q, setQ] = useState("");
  const [ed, setEd] = useState();
  const list = db.students.filter((s) => [s.name, s.class, s.roll].some((x) => (x || "").toLowerCase().includes(q.toLowerCase())));
  const save = (r) => {
    r = { ...r, id: r.id || uid("stu"), name: r.name.trim(), class: r.class.trim() };
    if (db.students.some((s) => s.id !== r.id && s.class === r.class && r.roll && s.roll === r.roll)) {
      toast(`Roll ${r.roll} is already taken in class ${r.class}.`); return false;
    }
    upsert("students", r); setEd(); toast(ed ? "Student updated." : "Student added.");
  };
  const remove = (s) => ask(`Remove ${s.name}? Their attendance and marks are removed too.`, () => {
    set("students", (l) => l.filter((x) => x.id !== s.id));
    set("attendance", (l) => l.filter((x) => x.studentId !== s.id));
    set("marks", (l) => l.filter((x) => x.studentId !== s.id));
    toast("Student removed.");
  });
  return (
    <>
      <Head title="Students" />
      <EntityForm title="student" fields={SF} initial={ed} onSave={save} onCancel={() => setEd()} />
      <div className="panel">
        <div className="toolbar"><input type="text" aria-label="Search students" placeholder="Search by name, class, or roll no." value={q} onChange={(e) => setQ(e.target.value)} />
          <button className="btn-sm ghost" onClick={() => downloadCsv([["Name", "Class", "Roll", "Gender", "Parent", "Contact"], ...list.map((s) => [s.name, s.class, s.roll, s.gender, s.parent, s.contact])], "students.csv")}>Export CSV</button></div>
        <div style={{ overflowX: "auto" }}>
          <table className="data">
            <thead><tr><th>Name</th><th>Class</th><th>Roll</th><th>Gender</th><th>Parent</th><th>Contact</th><th></th></tr></thead>
            <tbody>
              {list.length ? list.map((s) => (
                <tr key={s.id}>
                  <td><b>{s.name}</b></td><td>{s.class}</td><td className="mono">{s.roll || "—"}</td><td>{s.gender}</td><td>{s.parent || "—"}</td><td className="mono">{s.contact || "—"}</td>
                  <td>{isStaff(user) && <div className="row-actions"><button className="icon-btn" onClick={() => setEd(s)}>Edit</button><button className="icon-btn del" onClick={() => remove(s)}>Remove</button></div>}</td>
                </tr>
              )) : <tr><td colSpan="7"><Empty>No students match your search.</Empty></td></tr>}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}

/* ---------- Attendance (smart) ---------- */
export function Attendance() {
  const { db, set, user, toast } = useApp();
  const [date, setDate] = useState(today());
  const [cls, setCls] = useState("");
  const [q, setQ] = useState("");
  const [month, setMonth] = useState(today().slice(0, 7));
  const kid = isKid(user);
  let list = kid ? db.students.filter((s) => s.id === user.linkedId) : db.students;
  if (cls) list = list.filter((s) => s.class === cls);
  if (q) list = list.filter((s) => s.name.toLowerCase().includes(q.toLowerCase()));
  const st = (id) => db.attendance.find((a) => a.studentId === id && a.date === date)?.status;
  const mark = (ids, status) => {
    set("attendance", (l) => [...l.filter((a) => !(a.date === date && ids.includes(a.studentId))), ...ids.map((studentId) => ({ id: uid("att"), date, studentId, status }))]);
    if (status === "Absent") ids.forEach((id) => notify(set, { id: `abs-${id}-${date}`, studentId: id, audience: "family", type: "absence", title: "Absence recorded", body: `${db.students.find((s) => s.id === id)?.name} was marked absent on ${date}.` }));
  };
  const alerts = repeatedAbsent(db).filter((a) => list.some((s) => s.id === a.s.id));
  const counts = ["Present", "Absent", "Leave"].map((s) => `${list.filter((x) => st(x.id) === s).length} ${s.toLowerCase()}`).join(" · ");
  const [y, m] = month.split("-").map(Number), dim = new Date(y, m, 0).getDate(), days = Array.from({ length: dim }, (_, i) => i + 1);
  const rows = list.map((s) => ({ s, ...attStats(db, s.id, (a) => a.date.startsWith(month)), r: db.attendance.filter((a) => a.studentId === s.id && a.date.startsWith(month)) }));
  const csv = () => downloadCsv([["Student", "Class", "Roll", ...days, "Present", "Absent", "Leave", "Attendance %"], ...rows.map((x) => [x.s.name, x.s.class, x.s.roll, ...days.map((d) => x.r.find((a) => a.date === `${month}-${String(d).padStart(2, "0")}`)?.status?.[0] || ""), x.p, x.a, x.l, x.pct ?? ""])], `attendance-${cls || "all"}-${month}.csv`);
  const pill = (v) => v == null ? <span className="mono">—</span> : <span className={"status-pill " + (v >= 85 ? "Present" : v >= 75 ? "Leave" : "Absent")}>{v}%</span>;
  return (
    <>
      <Head title="Attendance" />
      {!kid && alerts.length > 0 && (
        <div className="panel alert-panel"><h3>⚠ Repeated absences</h3>
          {alerts.map((a) => <div className="fb-item" key={a.s.id}><span><b>{a.s.name}</b> ({a.s.class}) — absent {a.n} of last 5 marked days</span>
            <button className="btn-sm ghost" onClick={() => { notify(set, { id: `rep-${a.s.id}-${today()}`, studentId: a.s.id, audience: "family", type: "alert", title: "Repeated absences", body: `${a.s.name} has been absent ${a.n} of the last 5 school days. Please contact the class teacher.` }); toast("Family notified."); }}>Notify family</button></div>)}
        </div>
      )}
      <div className="panel">
        <div className="toolbar">
          <input type="date" aria-label="Date" value={date} onChange={(e) => setDate(e.target.value)} />
          <select aria-label="Class" value={cls} onChange={(e) => setCls(e.target.value)}><option value="">All classes</option>{classesOf(db).map((c) => <option key={c}>{c}</option>)}</select>
          {!kid && <input type="text" aria-label="Find student" placeholder="Find student…" value={q} onChange={(e) => setQ(e.target.value)} />}
          {isStaff(user) && <>
            <button className="btn-sm primary" onClick={() => { mark(list.map((s) => s.id), "Present"); toast(`${list.length} marked present.`); }}>Mark all present</button>
            <button className="btn-sm ghost" onClick={() => { const ids = list.filter((s) => !st(s.id)).map((s) => s.id); mark(ids, "Present"); toast(`${ids.length} unmarked marked present.`); }}>Mark unmarked present</button></>}
          <span className="mono">{counts}</span>
        </div>
        <div style={{ overflowX: "auto" }}><table className="data">
          <thead><tr><th>Name</th><th>Class / Roll</th><th>Overall</th><th>Status</th><th>Mark</th></tr></thead>
          <tbody>
            {list.length ? list.map((s) => (
              <tr key={s.id}>
                <td><b>{s.name}</b></td><td>{s.class}{s.roll ? " · Roll " + s.roll : ""}</td><td>{pill(attStats(db, s.id).pct)}</td>
                <td>{st(s.id) ? <span className={"status-pill " + st(s.id)}>{st(s.id)}</span> : <span className="mono">Not marked</span>}</td>
                <td>{isStaff(user) && <div className="row-actions">{["Present", "Absent", "Leave"].map((x) => <button key={x} className={"icon-btn mark-" + x + (st(s.id) === x ? " on" : "")} onClick={() => mark([s.id], x)}>{x}</button>)}</div>}</td>
              </tr>
            )) : <tr><td colSpan="5"><Empty>No students for this filter.</Empty></td></tr>}
          </tbody>
        </table></div>
      </div>
      <div className="panel"><h3>Monthly report</h3>
        <div className="toolbar"><input type="month" aria-label="Month" value={month} onChange={(e) => setMonth(e.target.value)} /><button className="btn-sm primary" onClick={csv}>Download CSV</button></div>
        <table className="data"><thead><tr><th>Student</th><th>Present</th><th>Absent</th><th>Leave</th><th>Marked days</th><th>Attendance</th></tr></thead>
          <tbody>{rows.map((x) => <tr key={x.s.id}><td><b>{x.s.name}</b></td><td>{x.p}</td><td>{x.a}</td><td>{x.l}</td><td>{x.n}</td><td>{pill(x.pct)}</td></tr>)}</tbody></table>
      </div>
    </>
  );
}

/* ---------- Staff ---------- */
const TF = [
  { k: "name", l: "Full name", req: 1 }, { k: "designation", l: "Designation", req: 1 }, { k: "subject", l: "Subject" },
  { k: "contact", l: "Contact number" }, { k: "email", l: "Email", t: "email" }, { k: "joinDate", l: "Joining date", t: "date" },
];
export function Staff() {
  const { db, set, toast, ask, upsert } = useApp();
  const [ed, setEd] = useState();
  const save = (r) => { upsert("staff", { ...r, id: r.id || uid("stf") }); setEd(); toast(ed ? "Staff updated." : "Staff member added."); };
  const remove = (s) => ask(`Remove ${s.name} from staff?`, () => { set("staff", (l) => l.filter((x) => x.id !== s.id)); toast("Staff member removed."); });
  return (
    <>
      <Head title="Staff" />
      <EntityForm title="staff member" fields={TF} initial={ed} onSave={save} onCancel={() => setEd()} />
      <div className="panel" style={{ overflowX: "auto" }}>
        <table className="data">
          <thead><tr><th>Name</th><th>Designation</th><th>Subject</th><th>Contact</th><th>Email</th><th></th></tr></thead>
          <tbody>
            {db.staff.length ? db.staff.map((s) => (
              <tr key={s.id}><td><b>{s.name}</b></td><td>{s.designation}</td><td>{s.subject || "—"}</td><td className="mono">{s.contact || "—"}</td><td className="mono">{s.email || "—"}</td>
                <td><div className="row-actions"><button className="icon-btn" onClick={() => setEd(s)}>Edit</button><button className="icon-btn del" onClick={() => remove(s)}>Remove</button></div></td></tr>
            )) : <tr><td colSpan="6"><Empty>No staff yet. Add the first member above.</Empty></td></tr>}
          </tbody>
        </table>
      </div>
    </>
  );
}

/* ---------- Exams & grades ---------- */
function MarksEntry({ exam }) {
  const { db, set, toast } = useApp();
  const students = db.students.filter((s) => s.class === exam.class);
  const init = () => Object.fromEntries(db.marks.filter((m) => m.examId === exam.id).map((m) => [m.studentId + "|" + m.subject, m.marks]));
  const [g, setG] = useState(init);
  useEffect(() => setG(init()), [exam.id]);
  const max = exam.subjects.reduce((a, s) => a + s.max, 0);
  const put = (key, val, cap) => setG({ ...g, [key]: val === "" ? "" : Math.min(cap, Math.max(0, Number(val))) });
  const save = () => {
    const rows = students.flatMap((s) => exam.subjects.filter((sub) => g[s.id + "|" + sub.name] !== undefined && g[s.id + "|" + sub.name] !== "").map((sub) => ({ id: uid("mrk"), examId: exam.id, studentId: s.id, subject: sub.name, marks: g[s.id + "|" + sub.name] })));
    set("marks", (l) => [...l.filter((m) => m.examId !== exam.id), ...rows]);
    students.filter((s) => rows.some((r) => r.studentId === s.id)).forEach((s) => notify(set, { id: `res-${exam.id}-${s.id}`, studentId: s.id, audience: "family", type: "result", title: `${exam.name} results published`, body: `Marks for ${s.name} are now in Exams & Grades.` }));
    toast("Marks saved.");
  };
  if (!students.length) return <Empty>No students in class {exam.class}.</Empty>;
  return (
    <>
      <div style={{ overflowX: "auto" }}>
        <table className="data">
          <thead><tr><th>Student</th>{exam.subjects.map((s) => <th key={s.name}>{s.name} /{s.max}</th>)}<th>Total</th><th>%</th><th>Grade</th></tr></thead>
          <tbody>
            {students.map((s) => {
              const vals = exam.subjects.map((sub) => g[s.id + "|" + sub.name]).filter((x) => x !== undefined && x !== "");
              const total = vals.reduce((a, b) => a + b, 0), pct = vals.length ? (total / max) * 100 : null;
              return (
                <tr key={s.id}><td><b>{s.name}</b></td>
                  {exam.subjects.map((sub) => <td key={sub.name}><input type="number" min="0" max={sub.max} aria-label={`${s.name} ${sub.name}`} style={{ width: 70 }} value={g[s.id + "|" + sub.name] ?? ""} onChange={(e) => put(s.id + "|" + sub.name, e.target.value, sub.max)} /></td>)}
                  <td className="mono">{vals.length ? total : "—"}</td><td className="mono">{pct == null ? "—" : pct.toFixed(1) + "%"}</td><td>{gradeFor(pct)}</td></tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <div className="actions-row"><button className="btn-sm primary" onClick={save}>Save marks</button></div>
    </>
  );
}

export function Exams() {
  const { db, set, user, toast, ask } = useApp();
  const [f, setF] = useState({ name: "", term: "", class: "", date: today(), subjects: "" });
  const [sel, setSel] = useState("");
  if (!isStaff(user)) {
    const me = db.students.find((s) => s.id === user.linkedId);
    const exams = me ? db.exams.filter((e) => e.class === me.class) : [];
    return (
      <>
        <Head title="My report card" />
        {!exams.length && <div className="panel"><Empty>No exams recorded for your class yet.</Empty></div>}
        {exams.map((ex) => {
          const rows = ex.subjects.map((s) => ({ ...s, got: db.marks.find((m) => m.examId === ex.id && m.studentId === me.id && m.subject === s.name)?.marks }));
          const has = rows.some((r) => r.got != null), total = rows.reduce((a, r) => a + (r.got || 0), 0), max = rows.reduce((a, r) => a + r.max, 0), pct = has ? (total / max) * 100 : null;
          return (
            <div className="panel" key={ex.id}>
              <h3>{ex.name} <span className="mono">{ex.term} · {ex.date}</span></h3>
              <table className="data"><thead><tr><th>Subject</th><th>Marks</th><th>Max</th></tr></thead>
                <tbody>{rows.map((r) => <tr key={r.name}><td>{r.name}</td><td className="mono">{r.got ?? "—"}</td><td className="mono">{r.max}</td></tr>)}</tbody></table>
              <p className="meta-line">Total <b>{has ? total : "—"}/{max}</b> · Percentage <b>{pct == null ? "—" : pct.toFixed(1) + "%"}</b> · Grade <b>{gradeFor(pct)}</b></p>
            </div>
          );
        })}
      </>
    );
  }
  const create = (e) => {
    e.preventDefault();
    const subjects = f.subjects.split(",").map((p) => p.split(":").map((x) => x.trim())).filter((p) => p[0]).map((p) => ({ name: p[0], max: Number(p[1]) || 100 }));
    if (!subjects.length) return toast("Add at least one subject, e.g. Mathematics:100");
    set("exams", (l) => [...l, { id: uid("exm"), ...f, class: f.class.trim(), subjects }]);
    setF({ name: "", term: "", class: "", date: today(), subjects: "" }); toast("Exam created.");
  };
  const exam = db.exams.find((e) => e.id === sel);
  const inp = (k, l, p = {}) => <div className={"field" + (p.full ? " full" : "")}><label htmlFor={"x-" + k}>{l}</label><input id={"x-" + k} required={p.req} type={p.t || "text"} placeholder={p.ph} value={f[k]} onChange={(e) => setF({ ...f, [k]: e.target.value })} /></div>;
  return (
    <>
      <Head title="Exams & grades" />
      <div className="panel"><h3>Add exam</h3>
        <form onSubmit={create}>
          <div className="form-grid">{inp("name", "Exam name", { req: 1, ph: "Unit Test 1" })}{inp("term", "Term")}{inp("class", "Class", { req: 1, ph: "8th" })}{inp("date", "Date", { t: "date" })}{inp("subjects", "Subjects (name:max marks, comma separated)", { req: 1, full: 1, ph: "Mathematics:100, Science:100" })}</div>
          <div className="actions-row"><button className="btn-sm primary">Create exam</button></div>
        </form>
      </div>
      <div className="panel"><h3>Enter marks</h3>
        <div className="toolbar">
          <select aria-label="Exam" value={sel} onChange={(e) => setSel(e.target.value)}><option value="">Choose an exam…</option>{db.exams.map((x) => <option key={x.id} value={x.id}>{x.name} — {x.class}</option>)}</select>
          {exam && <button className="btn-sm danger" onClick={() => ask(`Delete ${exam.name} and all its marks?`, () => { set("exams", (l) => l.filter((x) => x.id !== exam.id)); set("marks", (l) => l.filter((m) => m.examId !== exam.id)); setSel(""); toast("Exam removed."); })}>Delete exam</button>}
        </div>
        {exam ? <MarksEntry exam={exam} /> : <Empty>Choose an exam to enter marks.</Empty>}
      </div>
    </>
  );
}

/* ---------- Timetable ---------- */
const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat"], PERIODS = [1, 2, 3, 4, 5];
export function Timetable() {
  const { db, set, user, toast, ask } = useApp();
  const me = db.students.find((s) => s.id === user.linkedId);
  const classes = classesOf(db);
  const [cls, setCls] = useState(classes[0] || "");
  const active = isKid(user) && me ? me.class : cls;
  const blank = { day: "Mon", period: 1, subject: "", teacherId: "" };
  const [f, setF] = useState(blank);
  const [editId, setEditId] = useState(null);
  const slot = (d, p) => db.timetable.find((t) => t.class === active && t.day === d && t.period === p);
  const save = (e) => {
    e.preventDefault();
    const rec = { id: editId || uid("tt"), class: active, ...f, period: Number(f.period), teacherId: f.teacherId || null };
    set("timetable", (l) => [...l.filter((t) => t.id === rec.id || !(t.class === rec.class && t.day === rec.day && t.period === rec.period)).filter((t) => t.id !== rec.id), rec]);
    setF(blank); setEditId(null); toast("Timetable updated.");
  };
  return (
    <>
      <Head title="Timetable" />
      {isStaff(user) && (
        <div className="panel"><h3>{editId ? "Editing slot" : "Add / update slot"} — class {active || "?"}</h3>
          <form onSubmit={save}>
            <div className="form-grid">
              <div className="field"><label htmlFor="tt-day">Day</label><select id="tt-day" value={f.day} onChange={(e) => setF({ ...f, day: e.target.value })}>{DAYS.map((d) => <option key={d}>{d}</option>)}</select></div>
              <div className="field"><label htmlFor="tt-p">Period</label><select id="tt-p" value={f.period} onChange={(e) => setF({ ...f, period: e.target.value })}>{PERIODS.map((p) => <option key={p}>{p}</option>)}</select></div>
              <div className="field"><label htmlFor="tt-s">Subject</label><input id="tt-s" required value={f.subject} onChange={(e) => setF({ ...f, subject: e.target.value })} /></div>
              <div className="field"><label htmlFor="tt-t">Teacher</label><select id="tt-t" value={f.teacherId} onChange={(e) => setF({ ...f, teacherId: e.target.value })}><option value="">— None —</option>{db.staff.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</select></div>
            </div>
            <div className="actions-row"><button className="btn-sm primary">Save slot</button>{editId && <button type="button" className="btn-sm ghost" onClick={() => { setEditId(null); setF(blank); }}>Cancel edit</button>}</div>
          </form>
        </div>
      )}
      <div className="panel">
        {!isKid(user) && <div className="toolbar"><label className="mono" htmlFor="tt-c">Class</label><select id="tt-c" value={cls} onChange={(e) => setCls(e.target.value)}>{classes.map((c) => <option key={c}>{c}</option>)}</select></div>}
        {active ? (
          <div style={{ overflowX: "auto" }}>
            <table className="data tt-grid">
              <thead><tr><th>Period</th>{DAYS.map((d) => <th key={d}>{d}</th>)}</tr></thead>
              <tbody>{PERIODS.map((p) => (
                <tr key={p}><td className="mono">{p}</td>
                  {DAYS.map((d) => { const s = slot(d, p); return (
                    <td key={d}>{s ? <div className="tt-cell"><b>{s.subject}</b><span className="mono">{db.staff.find((x) => x.id === s.teacherId)?.name}</span>
                      {isStaff(user) && <div className="row-actions"><button className="icon-btn" onClick={() => { setEditId(s.id); setF({ day: s.day, period: s.period, subject: s.subject, teacherId: s.teacherId || "" }); }}>Edit</button><button className="icon-btn del" onClick={() => ask("Clear this slot?", () => { set("timetable", (l) => l.filter((t) => t.id !== s.id)); toast("Slot cleared."); })}>Clear</button></div>}</div> : <span className="mono">—</span>}</td>
                  ); })}
                </tr>))}</tbody>
            </table>
          </div>
        ) : <Empty>Add a student first so a class exists to schedule.</Empty>}
      </div>
    </>
  );
}

/* ---------- Notices ---------- */
export function Notices() {
  const { db, set, user, toast, ask } = useApp();
  const [f, setF] = useState({ title: "", message: "", date: today(), expiry: "" });
  const [all, setAll] = useState(false);
  const list = db.notices.filter((n) => all || !n.expiry || n.expiry >= today()).sort((a, b) => b.date.localeCompare(a.date));
  const post = (e) => { e.preventDefault(); set("notices", (l) => [...l, { id: uid("ntc"), ...f, postedBy: user.name }]); setF({ title: "", message: "", date: today(), expiry: "" }); toast("Notice posted."); };
  const inp = (k, l, t = "text", full) => <div className={"field" + (full ? " full" : "")}><label htmlFor={"n-" + k}>{l}</label><input id={"n-" + k} type={t} required={k === "title" || k === "message"} value={f[k]} onChange={(e) => setF({ ...f, [k]: e.target.value })} /></div>;
  return (
    <>
      <Head title="Notices & circulars" />
      {user.role === "Admin" && <div className="panel"><h3>Post notice</h3><form onSubmit={post}><div className="form-grid">{inp("title", "Title", "text", 1)}{inp("message", "Message", "text", 1)}{inp("date", "Date", "date")}{inp("expiry", "Expiry (optional)", "date")}</div><div className="actions-row"><button className="btn-sm primary">Post notice</button></div></form></div>}
      <label className="mono" style={{ display: "block", marginBottom: 12 }}><input type="checkbox" checked={all} onChange={(e) => setAll(e.target.checked)} /> Show expired</label>
      {list.length ? list.map((n) => {
        const exp = n.expiry && n.expiry < today();
        return (
          <div key={n.id} className={"panel notice-card" + (exp ? " notice-expired" : "")}>
            <div className="notice-head"><h3 style={{ border: 0, padding: 0, margin: 0 }}>{n.title}</h3><span className="mono">{n.date}{n.expiry ? " → " + n.expiry : ""}</span></div>
            <p className="notice-body">{n.message}</p>
            <p className="meta-line">Posted by {n.postedBy}{exp && " · Expired"} · {n.readBy?.includes(user.id) ? "Read ✓" : <button className="icon-btn on" onClick={() => set("notices", (l) => l.map((x) => (x.id === n.id ? { ...x, readBy: [...(x.readBy || []), user.id] } : x)))}>Mark as read</button>}{user.role === "Admin" && ` · Read by ${n.readBy?.length || 0}`}</p>
            {user.role === "Admin" && <div className="actions-row"><button className="btn-sm danger" onClick={() => ask("Remove this notice?", () => { set("notices", (l) => l.filter((x) => x.id !== n.id)); toast("Notice removed."); })}>Remove</button></div>}
          </div>
        );
      }) : <div className="panel"><Empty>No notices to show.</Empty></div>}
    </>
  );
}

/* ---------- Data: backup ---------- */
export function Data() {
  const { db, toast } = useApp();
  const exportAll = () => {
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([JSON.stringify({ _meta: { exportedAt: new Date().toISOString(), version: 3 }, ...db }, null, 2)], { type: "application/json" }));
    a.download = `school-erp-backup-${today()}.json`; a.click(); URL.revokeObjectURL(a.href); toast("Backup downloaded.");
  };
  return (
    <>
      <Head title="Data" />
      <div className="panel"><h3>Export backup</h3><p className="panel-note">Downloads every record — students, staff, attendance, exams, marks, timetable, notices and fees — as one JSON file. Keep it somewhere safe; it contains personal data.</p>
        <div className="actions-row"><button className="btn-sm primary" onClick={exportAll}>Download backup</button></div>
        <p className="mono meta-line">{db.students.length} students · {db.staff.length} staff · {db.attendance.length} attendance entries</p></div>
      <div className="panel"><h3>Restore</h3><p className="panel-note">Restoring is done on the server (it replaces live data, so it is not available from the browser). See the README: <span className="mono">npm run import-backup</span>.</p></div>
    </>
  );
}
