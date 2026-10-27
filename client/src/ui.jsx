import { createContext, useContext, useEffect, useState } from "react";


const ICONS = {
  dashboard: <><rect x="3" y="3" width="7" height="9" rx="1.5" /><rect x="14" y="3" width="7" height="5" rx="1.5" /><rect x="14" y="12" width="7" height="9" rx="1.5" /><rect x="3" y="16" width="7" height="5" rx="1.5" /></>,
  students: <><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M22 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" /></>,
  attendance: <><rect x="3" y="4" width="18" height="18" rx="2" /><path d="M16 2v4M8 2v4M3 10h18" /><path d="m9 16 2 2 4-4" /></>,
  staff: <><rect x="2" y="7" width="20" height="14" rx="2" /><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16" /></>,
  exams: <><rect x="8" y="2" width="8" height="4" rx="1" /><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" /><path d="M12 11h4M12 16h4M8 11h.01M8 16h.01" /></>,
  timetable: <><circle cx="12" cy="12" r="10" /><path d="M12 6v6l4 2" /></>,
  notices: <><path d="m3 11 18-5v12L3 14v-3z" /><path d="M11.6 16.8a3 3 0 1 1-5.8-1.6" /></>,
  events: <path d="m12 2 3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />,
  reports: <><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><path d="M14 2v6h6M8 13h8M8 17h8" /></>,
  feedback: <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />,
  analytics: <><path d="M3 3v18h18" /><path d="M7 16V9M12 16V5M17 16v-4" /></>,
  fees: <><path d="M6 3h12" /><path d="M6 8h12" /><path d="m6 13 8.5 8" /><path d="M6 13h3" /><path d="M9 13c6.667 0 6.667-10 0-10" /></>,
  inbox: <><path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" /><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" /></>,
  account: <><rect x="3" y="11" width="18" height="11" rx="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" /></>,
  users: <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />,
  data: <><ellipse cx="12" cy="5" rx="9" ry="3" /><path d="M3 5v14a9 3 0 0 0 18 0V5" /><path d="M3 12a9 3 0 0 0 18 0" /></>,
};
export const Icon = ({ n }) => (
  <svg viewBox="0 0 24 24" width="19" height="19" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{ICONS[n]}</svg>
);

export const Ctx = createContext(null);
export const useApp = () => useContext(Ctx);

export const Head = ({ title, right }) => (
  <header className="page-head"><h1>{title}</h1>{right && <div className="today">{right}</div>}</header>
);
export const Empty = ({ children }) => <div className="empty-state">{children}</div>;

// Config-driven add/edit form: fields = [{k, l, t?, req?, opts?, full?}]
export function EntityForm({ title, fields, initial, onSave, onCancel }) {
  const [v, setV] = useState(initial || {});
  useEffect(() => setV(initial || {}), [initial]);
  const submit = (e) => {
    e.preventDefault();
    const out = { ...v };
    fields.forEach((f) => { if (f.opts && !out[f.k]) out[f.k] = f.opts[0]; });
    if (onSave(out) !== false) setV({});
  };
  return (
    <div className="panel">
      <h3>{initial?.id ? "Edit" : "Add"} {title}</h3>
      <form onSubmit={submit}>
        <div className="form-grid">
          {fields.map((f) => (
            <div key={f.k} className={"field" + (f.full ? " full" : "")}>
              <label htmlFor={"f-" + f.k}>{f.l}</label>
              {f.opts ? (
                <select id={"f-" + f.k} value={v[f.k] ?? f.opts[0]} onChange={(e) => setV({ ...v, [f.k]: e.target.value })}>
                  {f.opts.map((o) => <option key={o}>{o}</option>)}
                </select>
              ) : (
                <input id={"f-" + f.k} type={f.t || "text"} required={f.req} value={v[f.k] || ""} onChange={(e) => setV({ ...v, [f.k]: e.target.value })} />
              )}
            </div>
          ))}
        </div>
        <div className="actions-row">
          <button className="btn-sm primary">Save {title}</button>
          {initial?.id && <button type="button" className="btn-sm ghost" onClick={onCancel}>Cancel edit</button>}
        </div>
      </form>
    </div>
  );
}

export const gradeFor = (p) => (p == null ? "—" : p >= 75 ? "A" : p >= 60 ? "B" : p >= 45 ? "C" : p >= 33 ? "D" : "F");

export function CountUp({ to }) {
  const [n, setN] = useState(0);
  useEffect(() => {
    let raf, t0;
    const step = (t) => { t0 ??= t; const p = Math.min(1, (t - t0) / 700); setN(Math.round(to * (1 - (1 - p) ** 3))); if (p < 1) raf = requestAnimationFrame(step); };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [to]);
  return <>{n}</>;
}
export function Stars({ value, onChange }) {
  return <span className="stars" role="radiogroup" aria-label="Rating">{[1, 2, 3, 4, 5].map((i) => (
    <button type="button" key={i} role="radio" aria-checked={value === i} aria-label={i + " star"} className={i <= value ? "on" : ""} onClick={() => onChange?.(i)} disabled={!onChange}>★</button>))}</span>;
}
export function downloadCsv(rows, name) {
  const q = (x) => `"${String(x ?? "").replace(/"/g, '""')}"`;
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([rows.map((r) => r.map(q).join(",")).join("\n")], { type: "text/csv" }));
  a.download = name; a.click(); URL.revokeObjectURL(a.href);
}

export const isKid = (u) => u.role === "Student" || u.role === "Parent";
export const REMARK = { A: "Excellent work", B: "Very good", C: "Satisfactory", D: "Needs improvement", F: "Needs urgent support" };
export const attStats = (db, id, pred = () => true) => {
  const r = db.attendance.filter((a) => a.studentId === id && pred(a));
  const c = (k) => r.filter((a) => a.status === k).length;
  return { p: c("Present"), a: c("Absent"), l: c("Leave"), n: r.length, pct: r.length ? Math.round((100 * c("Present")) / r.length) : null };
};
// Repeated absence: 3+ absences within a student's last 5 marked days
export const repeatedAbsent = (db) => db.students.map((s) => {
  const last = db.attendance.filter((a) => a.studentId === s.id).sort((x, y) => y.date.localeCompare(x.date)).slice(0, 5);
  return { s, n: last.filter((a) => a.status === "Absent").length };
}).filter((x) => x.n >= 3);
export const examPct = (db, ex, id) => {
  const m = db.marks.filter((k) => k.examId === ex.id && k.studentId === id);
  const max = ex.subjects.filter((s) => m.some((k) => k.subject === s.name)).reduce((a, s) => a + s.max, 0);
  return m.length && max ? (100 * m.reduce((a, k) => a + k.marks, 0)) / max : null;
};
export const notify = (set, r) => set("notifications", (l) => (l.some((n) => n.id === r.id) ? l : [...l, { read: false, date: new Date().toISOString().slice(0, 10), ...r }]));
export const myNotes = (db, u) => db.notifications.filter((n) => (isKid(u) ? n.audience === "family" && n.studentId === u.linkedId : true));
