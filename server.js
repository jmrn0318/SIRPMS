require("dotenv").config();
const express = require("express"), session = require("express-session"), PgStore = require("connect-pg-simple")(session),
  bcrypt = require("bcryptjs"), helmet = require("helmet"), rateLimit = require("express-rate-limit"), pool = require("./db");

if (!process.env.SESSION_SECRET) throw new Error("SESSION_SECRET is not set (see .env.example)");
const TZ = process.env.APP_TZ || "Asia/Manila", app = express();
app.set("trust proxy", 1);
app.use(helmet({ contentSecurityPolicy: false }));
app.use(express.json({ limit: "100kb" }));
app.use(session({
  store: new PgStore({ pool, createTableIfMissing: true }),
  secret: process.env.SESSION_SECRET, resave: false, saveUninitialized: false,
  cookie: { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", maxAge: 864e5 },
}));

/* ---------- helpers ---------- */
const q = (t, p) => pool.query(t, p).then(r => r.rows);
const E = (m, s = 400) => Object.assign(new Error(m), { status: s });
const wrap = f => (req, res, next) => f(req, res, next).catch(next);
const log = (req, a, d = "") => q("INSERT INTO activity_logs(actor_id,actor_name,role,action,detail) VALUES($1,$2,$3,$4,$5)",
  [req.user ? req.user.id : null, req.user ? req.user.name : "system", req.user ? req.user.role : "", a, d]);
const str = (v, n, max = 200) => { v = String(v == null ? "" : v).trim(); if (!v) throw E(n + " is required."); if (v.length > max) throw E(n + " is too long."); return v; };
const email = v => { v = str(v, "Email", 160).toLowerCase(); if (!/^\S+@\S+\.\S+$/.test(v)) throw E("Enter a valid email."); return v; };
const int = v => { const n = parseInt(v, 10); if (!Number.isInteger(n)) throw E("Invalid id."); return n; };
const dt = (v, n) => { if (!/^\d{4}-\d{2}-\d{2}$/.test(v || "")) throw E(n + " is required."); return v; };
const safe = u => ({ id: u.id, name: u.name, email: u.email, role: u.role, company: u.company, need: u.need_hours != null ? u.need_hours : u.need, active: u.active });

const auth = wrap(async (req, res, next) => {
  if (!req.session.uid) throw E("Unauthorized", 401);
  const [u] = await q("SELECT id,name,email,role,company,need_hours,active FROM users WHERE id=$1", [req.session.uid]);
  if (!u || !u.active) throw E("Unauthorized", 401);
  req.user = u; next();
});
const only = r => (req, res, next) => (req.user.role === r ? next() : next(E("Forbidden", 403)));
const coord = [auth, only("coordinator")], stud = [auth, only("student")];

/* ---------- auth ---------- */
app.post("/api/login", rateLimit({ windowMs: 60000, max: 10, message: { error: "Too many attempts. Try again in a minute." } }), wrap(async (req, res) => {
  const [u] = await q("SELECT * FROM users WHERE email=$1", [String(req.body.email || "").trim().toLowerCase()]);
  if (!u || !(await bcrypt.compare(String(req.body.password || ""), u.password_hash))) throw E("Invalid email or password.", 401);
  if (!u.active) throw E("Account is deactivated. Contact the coordinator.", 403);
  await new Promise((ok, no) => req.session.regenerate(e => (e ? no(e) : ok())));
  req.session.uid = u.id; req.user = u; await log(req, "Login", u.email);
  res.json({ user: safe(u) });
}));
app.post("/api/logout", (req, res) => req.session.destroy(() => res.json({ ok: 1 })));
app.get("/api/me", auth, (req, res) => res.json({ user: safe(req.user) }));
app.get("/api/public-stats", wrap(async (req, res) => {
  const [s] = await q(`SELECT (SELECT COUNT(*) FROM users WHERE role='student')::int students,
    (SELECT COALESCE(SUM(hours),0) FROM hour_logs WHERE status='Approved')::float hours,
    (SELECT COUNT(*) FROM submissions WHERE status='Approved')::int approved`);
  res.json(s);
}));

/* ---------- browse: role-scoped data ---------- */
const SQL = {
  users: "SELECT id,name,email,role,active,need_hours AS need,company FROM users WHERE role='student'",
  reqs: `SELECT id,title,description AS "desc",to_char(due_date,'YYYY-MM-DD') AS due,active FROM requirements`,
  subs: `SELECT s.id,s.student_id AS sid,s.requirement_id AS rid,s.note,s.status,COALESCE(s.remarks,'') AS remarks,s.submitted_at AS ts,
         (SELECT name FROM users WHERE id=s.reviewed_by) AS "by" FROM submissions s`,
  hrs: `SELECT h.id,h.student_id AS sid,to_char(h.log_date,'YYYY-MM-DD') AS date,h.hours::float AS hrs,h.task,h.status,COALESCE(h.remarks,'') AS remarks,
        (SELECT name FROM users WHERE id=h.reviewed_by) AS "by" FROM hour_logs h`,
  hist: "SELECT id,created_at AS ts,actor_name AS actor,actor_id,role,action,detail FROM activity_logs",
};
app.get("/api/data", auth, wrap(async (req, res) => {
  const me = req.user, c = me.role === "coordinator", id = me.id;
  const [users, reqs, subs, hrs, hist] = await Promise.all([
    c ? q(SQL.users + " ORDER BY name") : q(SQL.users.replace("role='student'", "id=$1"), [id]),
    q(SQL.reqs + (c ? "" : " WHERE active") + " ORDER BY due_date"),
    c ? q(SQL.subs) : q(SQL.subs + " WHERE s.student_id=$1", [id]),
    c ? q(SQL.hrs) : q(SQL.hrs + " WHERE h.student_id=$1", [id]),
    c ? q(SQL.hist + " ORDER BY id DESC LIMIT 300") : q(SQL.hist + " WHERE actor_id=$1 ORDER BY id DESC LIMIT 150", [id]),
  ]);
  res.json({ users, reqs, subs, hrs, hist });
}));

/* ---------- students (coordinator): add / edit / delete ---------- */
app.post("/api/students", coord, wrap(async (req, res) => {
  const b = req.body, name = str(b.name, "Name", 120), em = email(b.email), need = Number(b.need);
  if (!(need > 0)) throw E("Required hours must be greater than 0.");
  if (String(b.password || "").length < 8) throw E("Password must be at least 8 characters.");
  await q("INSERT INTO users(name,email,password_hash,role,company,need_hours) VALUES($1,$2,$3,'student',$4,$5)",
    [name, em, await bcrypt.hash(b.password, 10), String(b.company || "").trim().slice(0, 120), need]);
  await log(req, "Created student", em); res.json({ ok: 1 });
}));
app.put("/api/students/:id", coord, wrap(async (req, res) => {
  const b = req.body, id = int(req.params.id), name = str(b.name, "Name", 120), em = email(b.email), need = Number(b.need);
  if (!(need > 0)) throw E("Required hours must be greater than 0.");
  if (b.password && String(b.password).length < 8) throw E("Password must be at least 8 characters.");
  const r = await q("UPDATE users SET name=$1,email=$2,company=$3,need_hours=$4 WHERE id=$5 AND role='student' RETURNING id",
    [name, em, String(b.company || "").trim().slice(0, 120), need, id]);
  if (!r.length) throw E("Student not found.", 404);
  if (b.password) await q("UPDATE users SET password_hash=$1 WHERE id=$2", [await bcrypt.hash(b.password, 10), id]);
  await log(req, "Updated student", em); res.json({ ok: 1 });
}));
app.put("/api/students/:id/toggle", coord, wrap(async (req, res) => {
  const [u] = await q("UPDATE users SET active=NOT active WHERE id=$1 AND role='student' RETURNING email,active", [int(req.params.id)]);
  if (!u) throw E("Student not found.", 404);
  await log(req, u.active ? "Activated student" : "Deactivated student", u.email); res.json({ ok: 1 });
}));
app.delete("/api/students/:id", coord, wrap(async (req, res) => {
  const id = int(req.params.id), [u] = await q("SELECT email FROM users WHERE id=$1 AND role='student'", [id]);
  if (!u) throw E("Student not found.", 404);
  const [d] = await q("SELECT (SELECT COUNT(*) FROM submissions WHERE student_id=$1)+(SELECT COUNT(*) FROM hour_logs WHERE student_id=$1) n", [id]);
  if (+d.n) { await q("UPDATE users SET active=FALSE WHERE id=$1", [id]); await log(req, "Deactivated student", u.email); }
  else { await q("UPDATE activity_logs SET actor_id=NULL WHERE actor_id=$1", [id]); await q("DELETE FROM users WHERE id=$1", [id]); await log(req, "Deleted student", u.email); }
  res.json({ ok: 1 });
}));

/* ---------- requirements (coordinator manages; students browse via /api/data) ---------- */
const reqBody = b => ({ t: str(b.title, "Title", 160), d: String(b.desc || "").trim().slice(0, 500), due: dt(b.due, "Due date") });
app.post("/api/requirements", coord, wrap(async (req, res) => {
  const { t, d, due } = reqBody(req.body);
  await q("INSERT INTO requirements(title,description,due_date,created_by) VALUES($1,$2,$3,$4)", [t, d, due, req.user.id]);
  await log(req, "Created requirement", t); res.json({ ok: 1 });
}));
app.put("/api/requirements/:id", coord, wrap(async (req, res) => {
  const { t, d, due } = reqBody(req.body);
  const r = await q("UPDATE requirements SET title=$1,description=$2,due_date=$3 WHERE id=$4 RETURNING id", [t, d, due, int(req.params.id)]);
  if (!r.length) throw E("Requirement not found.", 404);
  await log(req, "Updated requirement", t); res.json({ ok: 1 });
}));
app.delete("/api/requirements/:id", coord, wrap(async (req, res) => {
  const id = int(req.params.id), [r] = await q("SELECT title FROM requirements WHERE id=$1", [id]);
  if (!r) throw E("Requirement not found.", 404);
  const [n] = await q("SELECT COUNT(*)::int c FROM submissions WHERE requirement_id=$1", [id]);
  if (n.c) { await q("UPDATE requirements SET active=FALSE WHERE id=$1", [id]); await log(req, "Archived requirement", r.title); }
  else { await q("DELETE FROM requirements WHERE id=$1", [id]); await log(req, "Deleted requirement", r.title); }
  res.json({ ok: 1 });
}));

/* ---------- submissions & hour logs: student add/edit/delete, coordinator review/delete ---------- */
async function own(table, req) {
  const [r] = await q(`SELECT * FROM ${table} WHERE id=$1 AND student_id=$2`, [int(req.params.id), req.user.id]);
  if (!r) throw E("Record not found.", 404);
  if (r.status === "Approved") throw E("Approved records cannot be changed.");
  return r;
}
function review(table, label) {
  return wrap(async (req, res) => {
    const id = int(req.params.id), dec = req.body.decision, rem = String(req.body.remarks || "").trim();
    if (!["Approved", "Rejected"].includes(dec)) throw E("Invalid decision.");
    if (dec === "Rejected" && !rem) throw E("Remarks are required to reject.");
    const r = await q(`UPDATE ${table} SET status=$1,remarks=$2,reviewed_by=$3 WHERE id=$4 AND status='Pending' RETURNING student_id`, [dec, dec === "Approved" ? null : rem, req.user.id, id]);
    if (!r.length) throw E("Only pending records can be reviewed.");
    await log(req, dec + " " + label, "record #" + id); res.json({ ok: 1 });
  });
}
app.post("/api/submissions", stud, wrap(async (req, res) => {
  const rid = int(req.body.requirement_id), note = str(req.body.note, "Note", 500);
  if (!(await q("SELECT 1 FROM requirements WHERE id=$1 AND active", [rid])).length) throw E("Select a valid requirement.");
  if ((await q("SELECT 1 FROM submissions WHERE student_id=$1 AND requirement_id=$2", [req.user.id, rid])).length) throw E("Already submitted. Edit the existing submission instead.");
  await q("INSERT INTO submissions(student_id,requirement_id,note) VALUES($1,$2,$3)", [req.user.id, rid, note]);
  await log(req, "Submitted requirement", "requirement #" + rid); res.json({ ok: 1 });
}));
app.put("/api/submissions/:id", stud, wrap(async (req, res) => {
  const r = await own("submissions", req);
  await q("UPDATE submissions SET note=$1,status='Pending',remarks=NULL,reviewed_by=NULL,submitted_at=now() WHERE id=$2", [str(req.body.note, "Note", 500), r.id]);
  await log(req, "Updated submission", "#" + r.id); res.json({ ok: 1 });
}));
app.post("/api/submissions/:id/review", coord, review("submissions", "requirement"));
app.delete("/api/submissions/:id", auth, wrap(async (req, res) => {
  if (req.user.role === "student") await own("submissions", req);
  await q("DELETE FROM submissions WHERE id=$1", [int(req.params.id)]);
  await log(req, "Deleted submission", "#" + req.params.id); res.json({ ok: 1 });
}));

async function hourRules(req, id) {
  const date = dt(req.body.date, "Date"), h = Number(req.body.hours), task = str(req.body.task, "Task", 255);
  if (!(h > 0)) throw E("Hours must be greater than 0.");
  const [f] = await q("SELECT $1::date > (now() AT TIME ZONE $2)::date AS future", [date, TZ]);
  if (f.future) throw E("Future dates are not allowed.");
  const [t] = await q("SELECT COALESCE(SUM(hours),0)::float t FROM hour_logs WHERE student_id=$1 AND log_date=$2 AND status<>'Rejected' AND id<>$3", [req.user.id, date, id]);
  if (t.t + h > 12) throw E("Maximum of 12 hours per day exceeded.");
  return { date, h, task };
}
app.post("/api/hours", stud, wrap(async (req, res) => {
  const { date, h, task } = await hourRules(req, 0);
  await q("INSERT INTO hour_logs(student_id,log_date,hours,task) VALUES($1,$2,$3,$4)", [req.user.id, date, h, task]);
  await log(req, "Logged hours", h + "h on " + date); res.json({ ok: 1 });
}));
app.put("/api/hours/:id", stud, wrap(async (req, res) => {
  const r = await own("hour_logs", req), { date, h, task } = await hourRules(req, r.id);
  await q("UPDATE hour_logs SET log_date=$1,hours=$2,task=$3,status='Pending',remarks=NULL,reviewed_by=NULL WHERE id=$4", [date, h, task, r.id]);
  await log(req, "Updated hours", h + "h on " + date); res.json({ ok: 1 });
}));
app.post("/api/hours/:id/review", coord, review("hour_logs", "hours"));
app.delete("/api/hours/:id", auth, wrap(async (req, res) => {
  if (req.user.role === "student") await own("hour_logs", req);
  await q("DELETE FROM hour_logs WHERE id=$1", [int(req.params.id)]);
  await log(req, "Deleted hour log", "#" + req.params.id); res.json({ ok: 1 });
}));

/* ---------- report: CSV export (coordinator) ---------- */
app.get("/api/export.csv", coord, wrap(async (req, res) => {
  const rows = await q(`SELECT u.name,u.email,u.company,u.need_hours,
    COALESCE((SELECT SUM(hours) FROM hour_logs h WHERE h.student_id=u.id AND h.status='Approved'),0)::float hrs,
    (SELECT COUNT(*) FROM submissions s JOIN requirements r ON r.id=s.requirement_id WHERE s.student_id=u.id AND s.status='Approved' AND r.active)::int ap,
    (SELECT COUNT(*) FROM requirements WHERE active)::int tot FROM users u WHERE u.role='student' ORDER BY u.name`);
  const cell = v => '"' + String(v).replace(/"/g, '""') + '"';
  const out = [["Student", "Email", "Company", "ApprovedHours", "RequiredHours", "RequirementsApproved", "TotalRequirements", "Status"]];
  rows.forEach(r => out.push([r.name, r.email, r.company, r.hrs, r.need_hours, r.ap, r.tot,
    r.hrs >= r.need_hours && r.ap === r.tot && r.tot > 0 ? "Completed" : r.hrs || r.ap ? "In Progress" : "Not Started"]));
  await log(req, "Exported CSV", "Progress report");
  res.set({ "Content-Type": "text/csv", "Content-Disposition": "attachment; filename=internship-progress.csv" }).send(out.map(r => r.map(cell).join(",")).join("\n"));
}));

/* ---------- static frontend + errors ---------- */
app.use("/api", (req, res) => res.status(404).json({ error: "Not found" }));
app.use(express.static(require("path").join(__dirname, "public")));
app.use((e, req, res, next) => {
  const dup = e.code === "23505", s = dup ? 400 : e.status || 500;
  if (s === 500) console.error(e);
  res.status(s).json({ error: dup ? "A record with that value already exists (e.g., duplicate email)." : s === 500 ? "Server error" : e.message });
});
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log("InternTrack running at http://localhost:" + PORT));