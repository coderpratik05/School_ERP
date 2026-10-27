// Who may read / write what. This is the real security layer —
// the React app only hides buttons, the server enforces the rules.

export const COLLECTIONS = ["students", "staff", "attendance", "exams", "marks", "timetable", "notices", "events", "payments", "feedback", "notifications", "fees", "ledger", "comments"];

export const isStaff = (u) => u.role === "Admin" || u.role === "Teacher";
export const isKid = (u) => u.role === "Student" || u.role === "Parent";

const STAFF = ["Admin", "Teacher"], ADMIN = ["Admin"], ALL = ["Admin", "Teacher", "Student", "Parent"];

// Roles allowed to create / edit records
const WRITE = {
  students: STAFF, staff: ADMIN, attendance: STAFF, exams: STAFF, marks: STAFF, timetable: STAFF,
  notices: STAFF, events: ADMIN, payments: ADMIN, fees: ADMIN, ledger: ADMIN, comments: STAFF,
  feedback: ALL, notifications: ALL,
};
// Roles allowed to delete records (defaults to WRITE)
const DELETE = { ...WRITE, notices: ADMIN, feedback: ADMIN, notifications: ADMIN };

// Order-independent comparison (Postgres jsonb does not keep key order)
const stable = (v) => (Array.isArray(v) ? v.map(stable) : v && typeof v === "object" ? Object.fromEntries(Object.keys(v).sort().map((k) => [k, stable(v[k])])) : v);
const same = (a, b) => JSON.stringify(stable(a)) === JSON.stringify(stable(b));
const without = (o, ...ks) => { const c = { ...o }; ks.forEach((k) => delete c[k]); return c; };

/** Can `user` create/update `incoming` in `name`? (`existing` is null for new records) */
export function canWrite(user, name, existing, incoming) {
  if (!WRITE[name]) return false;
  if (WRITE[name].includes(user.role) && !["feedback", "notices", "notifications"].includes(name)) return true;

  if (name === "feedback") // everyone may submit their own feedback, nobody may edit it
    return !existing && incoming.userId === user.id;

  if (name === "notices") {
    if (isStaff(user)) return true;
    // Students/parents may only mark a notice as read by themselves
    if (!existing) return false;
    const before = existing.readBy || [], after = incoming.readBy || [];
    const added = after.filter((x) => !before.includes(x));
    return same(without(existing, "readBy"), without(incoming, "readBy")) && before.every((x) => after.includes(x)) && added.every((x) => x === user.id);
  }

  if (name === "notifications") {
    if (isStaff(user)) return true;
    // Students/parents may only flip `read` on their own family notifications
    return !!existing && existing.audience === "family" && existing.studentId === user.linkedId && same(without(existing, "read"), without(incoming, "read"));
  }
  return false;
}

export const canDelete = (user, name) => !!DELETE[name]?.includes(user.role);

/**
 * SQL filter for reads. Returns { where, params } appended after "collection = $1".
 * `klass` is the class of the student linked to a Student/Parent account.
 */
export function readFilter(user, name, klass) {
  if (!isKid(user)) {
    if (name === "feedback" && user.role !== "Admin") return { where: "AND data->>'userId' = $2", params: [user.id] };
    return { where: "", params: [] };
  }
  const sid = user.linkedId || "__none__";
  switch (name) {
    case "students": return { where: "AND id = $2", params: [sid] };
    case "attendance": case "marks": case "payments": case "ledger": return { where: "AND data->>'studentId' = $2", params: [sid] };
    case "exams": case "fees": case "timetable": return { where: "AND data->>'class' = $2", params: [klass || "__none__"] };
    case "feedback": return { where: "AND data->>'userId' = $2", params: [user.id] };
    case "notifications": return { where: "AND data->>'audience' = 'family' AND data->>'studentId' = $2", params: [sid] };
    case "comments": return { where: "AND right(id, length($2) + 1) = '-' || $2", params: [sid] };
    default: return { where: "", params: [] }; // staff (list), notices, events
  }
}

// Staff contact details are hidden from students/parents
export const shape = (user, name, rec) => (isKid(user) && name === "staff" ? without(rec, "contact", "email") : rec);
