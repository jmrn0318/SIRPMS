require("dotenv").config();
const fs = require("fs"), bcrypt = require("bcryptjs"), pool = require("./db");
(async () => {
  await pool.query(fs.readFileSync(__dirname + "/schema.sql", "utf8"));
  const { rows } = await pool.query("SELECT COUNT(*)::int n FROM users");
  if (rows[0].n) { console.log("Database already has data. Schema verified."); return pool.end(); }
  const U = async (n, e, r, p, c, hrs = 300) => (await pool.query(
    "INSERT INTO users(name,email,password_hash,role,company,need_hours) VALUES($1,$2,$3,$4,$5,$6) RETURNING id",
    [n, e, await bcrypt.hash(p, 10), r, c, hrs])).rows[0].id;
  const co = await U("Prof. Maria Reyes", "coordinator@school.edu", "coordinator", "Admin@123", "School Internship Office", 0);
  const st = [];
  for (const [n, e, c] of [["Juan Dela Cruz", "juan@school.edu", "Accenture PH"], ["Ana Santos", "ana@school.edu", "Globe Telecom"], ["Mark Lim", "mark@school.edu", "DOST-ICTO"]])
    st.push(await U(n, e, "student", "Student@123", c));
  const R = [];
  for (const [t, d, n] of [["Internship Endorsement Letter", "School-issued letter addressed to host company", -20], ["Memorandum of Agreement (MOA)", "Signed by student, company, and school", -5], ["Weekly Accomplishment Report", "Signed weekly report", 7], ["Final Internship Report", "Complete narrative report", 45]])
    R.push((await pool.query("INSERT INTO requirements(title,description,due_date,created_by) VALUES($1,$2,CURRENT_DATE+$3::int,$4) RETURNING id", [t, d, n, co])).rows[0].id);
  const S = (s, r, status, rem = null) => pool.query("INSERT INTO submissions(student_id,requirement_id,note,status,remarks,reviewed_by) VALUES($1,$2,'Scanned copy submitted',$3,$4,$5)", [st[s], R[r], status, rem, status === "Pending" ? null : co]);
  await S(0, 0, "Approved"); await S(0, 1, "Pending"); await S(1, 0, "Approved"); await S(1, 1, "Rejected", "Missing company signature");
  const H = (s, n, h, t, status) => pool.query("INSERT INTO hour_logs(student_id,log_date,hours,task,status,reviewed_by) VALUES($1,CURRENT_DATE+$2::int,$3,$4,$5,$6)", [st[s], n, h, t, status, status === "Pending" ? null : co]);
  await H(0, -3, 8, "Database setup and testing", "Approved"); await H(0, -2, 8, "API documentation", "Approved"); await H(0, -1, 6, "Bug fixing", "Pending");
  await H(1, -2, 8, "Network monitoring", "Approved"); await H(2, -1, 4, "Orientation", "Pending");
  await pool.query("INSERT INTO activity_logs(actor_name,role,action,detail) VALUES('system','','Seeded demo data','Initial demo accounts and records')");
  console.log("Seed complete."); await pool.end();
})().catch(e => { console.error(e); process.exit(1); });
