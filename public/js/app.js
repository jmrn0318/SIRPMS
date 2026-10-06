/* InternTrack – FUNCTIONALITY layer: icons, screens (views), actions, navigation, and startup.
   Depends on data.js (state, api, prog, lst). Styling lives in css/styles.css. */

/* ---------- icons ---------- */
const IC = {
  back: "M19 12H5 M12 19l-7-7 7-7", cap: "M22 10 12 5 2 10l10 5 10-5z M6 12v5c3 3 9 3 12 0v-5", chart: "M3 3v18h18 M7 14v4 M12 8v10 M17 11v7",
  users: "M17 21v-2a4 4 0 0 0-4-4H7a4 4 0 0 0-4 4v2 M10 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8 M21 21v-2a4 4 0 0 0-3-3.9 M16 3.1a4 4 0 0 1 0 7.8",
  list: "M9 3h6v4H9z M7 5H5v16h14V5h-2 M9 12h6 M9 16h6", ok: "M22 11.1V12a10 10 0 1 1-5.9-9.1 M22 4 12 14l-3-3", clock: "M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18 M12 7v5l3 2",
  history: "M3 12a9 9 0 1 0 3-6.7L3 8 M3 3v5h5 M12 7v5l3 2", trend: "M3 17l6-6 4 4 8-8 M15 7h6v6", file: "M14 3H6v18h12V7z M14 3v4h4 M9 13h6 M9 17h6",
  hour: "M6 2h12 M6 22h12 M7 2v4l5 6-5 6v4 M17 2v4l-5 6 5 6v4", alert: "M12 3 2 20h20z M12 10v4 M12 17h.01", check: "M5 12l5 5 9-9",
  plus: "M12 5v14 M5 12h14", menu: "M3 6h18 M3 12h18 M3 18h18", edit: "M12 20h9 M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z",
  trash: "M3 6h18 M8 6V4h8v2 M19 6l-1 14H6L5 6", eye: "M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12 M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6",
  out: "M9 21H5V3h4 M16 17l5-5-5-5 M21 12H9", x: "M18 6 6 18 M6 6l12 12"
};
const ic = n => `<svg class="ic" viewBox="0 0 24 24" aria-hidden="true">${IC[n].split(" M").map((d, i) => `<path d="${i ? "M" + d : d}"/>`).join("")}</svg>`;
const tag = s => `<span class="tag ${s.replace(/ /g, "")}">${s}</span>`;
const ib = (i, t, fn, c = "g") => `<button class="${c} s ib" title="${t}" onclick="${fn}">${ic(i)}</button>`;
const none = n => `<tr><td colspan="${n}" class="mu">No records found.</td></tr>`;

/* ---------- modal + toast ---------- */
const closeM = () => { M = ""; render(); }, modal = h => { M = h; render(); };
function toast(t) { const d = document.createElement("div"); d.className = "toast"; d.textContent = t; document.body.appendChild(d); setTimeout(() => d.remove(), 2600); }
window.alert = toast;
addEventListener("keydown", e => { if (e.key == "Escape" && M) closeM(); });

/* ---------- search / sort bar ---------- */
const bar2 = (k, ops, sorts) => `<div class="row"><input placeholder="Search…" id="s_${k}" value="${esc(F[k + "q"] || "")}" oninput="F['${k}q']=this.value;render(1)">${ops.length ? `<select onchange="F['${k}s']=this.value;render()"><option value="">All status</option>${ops.map(o => `<option ${F[k + "s"] == o ? "selected" : ""}>${o}</option>`).join("")}</select>` : ""}<select onchange="F['${k}o']=this.value;render()">${sorts.map(x => `<option value="${x[0]}" ${(F[k + "o"] || sorts[0][0]) == x[0] ? "selected" : ""}>${x[1]}</option>`).join("")}</select></div>`;

/* ---------- auth ---------- */
async function login() {
  try {
    const r = await api("/api/login", "POST", { email: $("#le").value.trim(), password: $("#lp").value });
    me = r.user; msg = ""; stack = []; tab = me.role == "student" ? "prog" : "dash"; await load(); render();
  } catch (e) { msg = e.message; render(); }
}
function logout() {
  api("/api/logout", "POST").catch(() => {}).finally(() => { me = null; showLogin = false; stack = []; Object.keys(S).forEach(k => S[k] = []); render(); });
}
function exp() { location.href = "/api/export.csv"; }

/* ---------- record details / add-edit form / save ---------- */
const FLD = {
  users: [["Name", "name"], ["Email", "email"], ["Company", "company"], ["Required hours", "need"], ["Status", o => o.active ? "Active" : "Inactive"]],
  reqs: [["Title", "title"], ["Description", "desc"], ["Due date", "due"], ["Status", o => o.active === false ? "Archived" : "Active"]],
  subs: [["Student", o => U(o.sid).name], ["Requirement", o => R(o.rid).title], ["Note", "note"], ["Status", "status"], ["Remarks", "remarks"], ["Submitted", o => new Date(o.ts).toLocaleString()], ["Reviewed by", "by"]],
  hrs: [["Student", o => U(o.sid).name], ["Date", "date"], ["Hours", "hrs"], ["Task", "task"], ["Status", "status"], ["Remarks", "remarks"], ["Reviewed by", "by"]],
  hist: [["When", o => new Date(o.ts).toLocaleString()], ["User", "actor"], ["Role", "role"], ["Action", "action"], ["Detail", "detail"]]
};
function vw(c, i) {
  const o = S[c].find(x => x.id == i);
  if (o) modal(`<h2>Record details</h2><table>${FLD[c].map(([l, k]) => `<tr><th>${l}</th><td>${esc(typeof k == "function" ? k(o) : o[k] || "-")}</td></tr>`).join("")}</table><div class="row" style="margin-top:12px"><button class="g" onclick="closeM()">Close</button></div>`);
}
function fm(c, i, r) {
  const o = S[c].find(x => x.id == i) || {}, I = (id, l, v, t = "text", x = "") => `<label>${l}</label><input id="${id}" type="${t}" value="${esc(v)}" ${x}>`; let b = "";
  if (c == "users") b = I("f1", "Full name", o.name || "") + I("f2", "Email", o.email || "") + I("f3", "Host company", o.company || "") + I("f4", "Required hours", o.need || 300, "number", 'min="1"') + I("f5", "Password" + (i ? " (leave blank to keep)" : ""), "", "password");
  if (c == "reqs") b = I("f1", "Title", o.title || "") + I("f2", "Description", o.desc || "") + I("f3", "Due date", o.due || "", "date");
  if (c == "hrs") b = I("f1", "Date", o.date || today(), "date", `max="${today()}"`) + I("f2", "Hours (max 12/day)", o.hrs || "", "number", 'step="0.5" min="0.5" max="12"') + I("f3", "Task performed", o.task || "");
  if (c == "subs") {
    const av = S.reqs.filter(q => q.active !== false && !S.subs.some(x => x.sid == me.id && x.rid == q.id));
    b = (i ? `<label>Requirement</label><input value="${esc(R(o.rid).title)}" disabled>` : `<label>Requirement</label><select id="f1"><option value="">Select…</option>${av.map(q => `<option value="${q.id}" ${q.id == r ? "selected" : ""}>${esc(q.title)}</option>`).join("")}</select>`) + I("f2", "Note / file reference", o.note || "");
  }
  modal(`<h2>${i ? "Edit" : "Add"} ${NM[c]}</h2><div class="fr">${b}</div><div class="err" id="me"></div><div class="row"><button onclick="sv('${c}','${i || ""}')">Save</button><button class="g" onclick="closeM()">Cancel</button></div>`);
}
async function sv(c, i) {
  const v = k => (($("#" + k) || {}).value || "").trim(), er = t => { $("#me").textContent = t; }; let b;
  if (c == "users") b = { name: v("f1"), email: v("f2"), company: v("f3"), need: +v("f4"), password: $("#f5").value };
  if (c == "reqs") b = { title: v("f1"), desc: v("f2"), due: v("f3") };
  if (c == "hrs") b = { date: v("f1"), hours: +v("f2"), task: v("f3") };
  if (c == "subs") b = { requirement_id: v("f1"), note: v("f2") };
  try { await api("/api/" + EP[c] + (i ? "/" + i : ""), i ? "PUT" : "POST", b); await load(); closeM(); toast("Saved"); } catch (e) { er(e.message); }
}

/* ---------- delete / toggle / review ---------- */
function dl(c, i) {
  const o = S[c].find(x => x.id == i); if (!o) return;
  if (me.role == "student" && o.status == "Approved") return toast("Approved records cannot be deleted.");
  modal(`<h2>Delete this record?</h2><p class="mu">${(c == "reqs" && S.subs.some(x => x.rid == i)) || (c == "users" && (S.subs.some(x => x.sid == i) || S.hrs.some(x => x.sid == i))) ? "This record has related data, so it will be archived/deactivated instead of removed." : "This action cannot be undone."}</p><div class="row"><button class="no" onclick="doDel('${c}','${i}')">Confirm</button><button class="g" onclick="closeM()">Cancel</button></div>`);
}
async function doDel(c, i) { try { await api("/api/" + EP[c] + "/" + i, "DELETE"); await load(); closeM(); toast("Done"); } catch (e) { closeM(); toast(e.message); } }
async function tgl(i) { try { await api("/api/students/" + i + "/toggle", "PUT"); await load(); render(); } catch (e) { toast(e.message); } }
async function rv(c, i) { try { await api("/api/" + EP[c] + "/" + i + "/review", "POST", { decision: "Approved" }); await load(); render(); toast("Approved"); } catch (e) { toast(e.message); } }
function rj(c, i) { modal(`<h2>Reject record</h2><label>Remarks (required)</label><textarea id="rm" rows="3"></textarea><div class="err" id="me"></div><div class="row"><button class="no" onclick="rjOk('${c}','${i}')">Reject</button><button class="g" onclick="closeM()">Cancel</button></div>`); }
async function rjOk(c, i) {
  const m = $("#rm").value.trim(); if (!m) return $("#me").textContent = "Remarks are required to reject.";
  try { await api("/api/" + EP[c] + "/" + i + "/review", "POST", { decision: "Rejected", remarks: m }); await load(); closeM(); } catch (e) { $("#me").textContent = e.message; }
}
const acts = (c, x) => {
  const co = me.role == "coordinator";
  return ib("eye", "Read", `vw('${c}','${x.id}')`) + (co ? (x.status == "Pending" ? ib("ok", "Approve", `rv('${c}','${x.id}')`, "ok") + ib("x", "Reject", `rj('${c}','${x.id}')`, "no") : "") + ib("trash", "Delete", `dl('${c}','${x.id}')`) : x.status != "Approved" ? ib("edit", "Edit", `fm('${c}','${x.id}')`) + ib("trash", "Delete", `dl('${c}','${x.id}')`) : "");
};

/* ---------- screens (modules) ---------- */
function V_dash() {
  const sv = false, sts = S.users.filter(u => u.role == "student" && (!sv || u.sup == me.id)), P = sts.map(u => ({ u, p: prog(u) }));
  return `<div class="grid"><div class="stat"><b>${sts.filter(u => u.active).length}</b>${ic('users')} Active students</div><div class="stat"><b>${S.subs.filter(s => s.status == "Pending").length}</b>${ic('file')} Pending requirements</div><div class="stat"><b>${S.hrs.filter(s => s.status == "Pending").length}</b>${ic('hour')} Pending hour logs</div><div class="stat"><b>${P.filter(x => x.p.st == "Completed").length}</b>${ic('cap')} Completed</div><div class="stat"><b>${P.reduce((a, x) => a + x.p.od, 0)}</b>${ic('alert')} Overdue items</div></div>
 <div class="card"><h2>Student Progress</h2><div class="tw"><table><tr><th>Student</th><th>Company</th><th>Hours</th><th>Requirements</th><th>Overall</th><th>Status</th></tr>${P.map(({ u, p }) => `<tr><td>${esc(u.name)}${u.active ? "" : " <span class=mu>(inactive)</span>"}</td><td>${esc(u.company)}</td><td>${p.hrs}/${u.need}</td><td>${p.ap}/${p.tot}${p.od ? ` ${tag("Overdue")}` : ""}</td><td><div class="bar"><i style="width:${p.pct}%"></i></div>${p.pct}%</td><td>${tag(p.st)}</td></tr>`).join("")}</table></div>
 <p><button class="g s" onclick="exp()">Export CSV report</button></p></div>`;
}
function V_stu() {
  const A = S.users.filter(u => u.role == "student").map(u => ({ ...u, status: u.active ? "Active" : "Inactive" })), sb = [["a", "Name A-Z", (a, b) => a.name.localeCompare(b.name)], ["z", "Name Z-A", (a, b) => b.name.localeCompare(a.name)]];
  return `<div class="card"><div class="ph"><h2>Students</h2><button onclick="fm('users')">${ic('plus')} Add student</button></div>${bar2("u", ["Active", "Inactive"], sb)}<div class="tw"><table><tr><th>Name</th><th>Email</th><th>Company</th><th>Hours</th><th>Status</th><th>Actions</th></tr>${lst("u", A, sb).map(u => `<tr><td>${esc(u.name)}</td><td>${esc(u.email)}</td><td>${esc(u.company)}</td><td>${prog(u).hrs}/${u.need}</td><td>${u.status}</td><td>${ib("eye", "Read", `vw('users','${u.id}')`)}${ib("edit", "Edit", `fm('users','${u.id}')`)}${ib("clock", u.active ? "Deactivate" : "Activate", `tgl('${u.id}')`)}${ib("trash", "Delete", `dl('users','${u.id}')`)}</td></tr>`).join("") || none(6)}</table></div></div>`;
}
function V_req() {
  const co = me.role == "coordinator", mine = r => S.subs.find(x => x.sid == me.id && x.rid == r.id),
    A = S.reqs.filter(r => co || r.active !== false).map(r => ({ ...r, status: co ? (r.active === false ? "Archived" : "Active") : (mine(r) ? mine(r).status : "Not submitted") })),
    sb = [["d", "Due soonest", (a, b) => a.due > b.due ? 1 : -1], ["l", "Due latest", (a, b) => a.due < b.due ? 1 : -1], ["t", "Title A-Z", (a, b) => a.title.localeCompare(b.title)]];
  return `<div class="card"><div class="ph"><h2>${co ? "Requirements" : "Requirements Checklist"}</h2>${co ? `<button onclick="fm('reqs')">${ic('plus')} Add requirement</button>` : ""}</div>${bar2("r", co ? ["Active", "Archived"] : ["Not submitted", "Pending", "Approved", "Rejected"], sb)}<div class="tw"><table><tr><th>Requirement</th><th>Due</th><th>${co ? "Submissions" : "My status"}</th><th>Actions</th></tr>${lst("r", A, sb).map(r => { const m = mine(r); return `<tr><td><b>${esc(r.title)}</b><div class="mu">${esc(r.desc)}</div></td><td>${r.due}${!co && r.due < today() && (!m || m.status != "Approved") ? " " + tag("Overdue") : ""}</td><td>${co ? S.subs.filter(x => x.rid == r.id).length + " (" + r.status + ")" : m ? tag(m.status) + (m.remarks ? `<div class="mu">${esc(m.remarks)}</div>` : "") : "Not submitted"}</td><td>${ib("eye", "Read", `vw('reqs','${r.id}')`)}${co ? ib("edit", "Edit", `fm('reqs','${r.id}')`) + ib("trash", "Delete", `dl('reqs','${r.id}')`) : !m ? `<button class="s" onclick="fm('subs','','${r.id}')">Submit</button>` : m.status == "Rejected" ? `<button class="s" onclick="fm('subs','${m.id}')">Resubmit</button>` : ""}</td></tr>`; }).join("") || none(4)}</table></div></div>`;
}
function V_subs() {
  const co = me.role == "coordinator", A = S.subs.filter(x => co || x.sid == me.id).map(x => ({ ...x, _: U(x.sid).name + " " + R(x.rid).title })), sb = [["n", "Newest first", (a, b) => b.ts > a.ts ? 1 : -1], ["o", "Oldest first", (a, b) => a.ts > b.ts ? 1 : -1]];
  return `<div class="card"><div class="ph"><h2>${co ? "Requirement Submissions" : "My Submissions"}</h2>${co ? "" : `<button onclick="fm('subs')">${ic('plus')} Submit requirement</button>`}</div>${bar2("b", ST, sb)}<div class="tw"><table><tr>${co ? "<th>Student</th>" : ""}<th>Requirement</th><th>Note</th><th>Submitted</th><th>Status</th><th>Actions</th></tr>${lst("b", A, sb).map(x => `<tr>${co ? `<td>${esc(U(x.sid).name)}</td>` : ""}<td>${esc(R(x.rid).title)}</td><td>${esc(x.note)}</td><td>${new Date(x.ts).toLocaleDateString()}</td><td>${tag(x.status)}<div class="mu">${esc(x.remarks)}</div></td><td>${acts("subs", x)}</td></tr>`).join("") || none(6)}</table></div></div>`;
}
function V_hrs() {
  const co = me.role == "coordinator", A = S.hrs.filter(x => co || x.sid == me.id).map(x => ({ ...x, _: U(x.sid).name })), sb = [["n", "Newest first", (a, b) => b.date > a.date ? 1 : -1], ["o", "Oldest first", (a, b) => a.date > b.date ? 1 : -1], ["h", "Most hours", (a, b) => b.hrs - a.hrs]];
  return `<div class="card"><div class="ph"><h2>${co ? "Hour Logs" : "My Hour Logs"}</h2>${co ? "" : `<button onclick="fm('hrs')">${ic('plus')} Log hours</button>`}</div>${co ? "" : `<p class="mu">Rules: no future dates, max 12 hours per day, approved logs cannot be edited.</p>`}${bar2("h", ST, sb)}<div class="tw"><table><tr>${co ? "<th>Student</th>" : ""}<th>Date</th><th>Hrs</th><th>Task</th><th>Status</th><th>Actions</th></tr>${lst("h", A, sb).map(x => `<tr>${co ? `<td>${esc(U(x.sid).name)}</td>` : ""}<td>${x.date}</td><td>${x.hrs}</td><td>${esc(x.task)}</td><td>${tag(x.status)}<div class="mu">${esc(x.remarks)}</div></td><td>${acts("hrs", x)}</td></tr>`).join("") || none(6)}</table></div></div>`;
}
function V_prog() {
  const p = prog(me), h = me.need ? p.hrs / me.need : 0, S5 = [["Requirements started", S.subs.some(x => x.sid == me.id)], ["Documents approved", p.tot > 0 && p.ap == p.tot], ["50% hours", h >= .5], ["Hours complete", h >= 1], ["Completed", p.st == "Completed"]];
  return `<div class="card"><div class="welcome"><div class="ring" style="background:conic-gradient(var(--pr2) ${p.pct * 3.6}deg,var(--bd) 0)"><div>${p.pct}%</div></div><div><h2 style="margin:0">Welcome, ${esc(me.name.split(" ")[0])}</h2><div class="mu">Host company: <b>${esc(me.company || "Not assigned")}</b></div><p>${tag(p.st)} ${p.od ? tag("Overdue") + " " + p.od + " requirement(s) overdue" : ""}</p></div></div></div>
<div class="grid"><div class="stat"><b>${p.hrs}/${me.need}</b>${ic('clock')} Approved hours</div><div class="stat"><b>${p.ap}/${p.tot}</b>${ic('list')} Requirements approved</div><div class="stat"><b>${Math.max(0, me.need - p.hrs)}</b>${ic('hour')} Hours remaining</div></div>
<div class="card"><h2>Internship Journey</h2><div class="steps">${S5.map((x, i) => `<div class="st ${x[1] ? "d" : ""}"><i>${x[1] ? ic("check") : i + 1}</i>${x[0]}</div>`).join("")}</div><p class="mu">Your internship is marked <b>Completed</b> automatically once all requirements are approved and the required hours are reached.</p></div>`;
}
function V_hist() {
  const co = me.role == "coordinator", A = S.hist.filter(h => co || h.actor_id == me.id), sb = [["n", "Newest first", (a, b) => b.ts > a.ts ? 1 : -1], ["o", "Oldest first", (a, b) => a.ts > b.ts ? 1 : -1]];
  return `<div class="card"><div class="ph"><h2>Activity History</h2></div><p class="mu">The audit trail is read-only so records cannot be altered.</p>${bar2("y", [], sb)}<div class="tw"><table><tr><th>When</th><th>User</th><th>Action</th><th>Detail</th><th></th></tr>${lst("y", A, sb).slice(0, 150).map(h => `<tr><td>${new Date(h.ts).toLocaleString()}</td><td>${esc(h.actor)}</td><td>${esc(h.action)}</td><td>${esc(h.detail)}</td><td>${ib("eye", "Read", `vw('hist','${h.id}')`)}</td></tr>`).join("") || none(5)}</table></div></div>`;
}

/* ---------- navigation ---------- */
const push = () => { try { history.pushState({ n: 1 }, ""); } catch (e) {} };
function go(t) { if (t == tab) { render(); return; } stack.push(tab); tab = t; msg = ""; push(); render(); }
function back() { if (me) { if (!stack.length) return; tab = stack.pop(); } else showLogin = false; msg = ""; render(); scrollTo(0, 0); }
addEventListener("popstate", () => { if (me) { if (stack.length) tab = stack.pop(); } else showLogin = false; msg = ""; render(); });
const goLogin = () => { showLogin = true; push(); render(); scrollTo(0, 0); }, goTo = i => document.getElementById(i).scrollIntoView({ behavior: "smooth" });

/* ---------- landing page ---------- */
const BG = (() => {
  let r = 7, rnd = () => (r = r * 16807 % 2147483647) / 2147483647, o = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1600 900" preserveAspectRatio="xMidYMid slice"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#0b2f55"/><stop offset=".6" stop-color="#0f4c81"/><stop offset="1" stop-color="#14a39a"/></linearGradient><radialGradient id="s"><stop offset="0" stop-color="#f5a623" stop-opacity=".75"/><stop offset="1" stop-color="#f5a623" stop-opacity="0"/></radialGradient><pattern id="w" width="22" height="28" patternUnits="userSpaceOnUse"><rect x="6" y="7" width="8" height="12" fill="#ffd98a" opacity=".32"/></pattern></defs><rect width="1600" height="900" fill="url(#g)"/><circle cx="1250" cy="250" r="240" fill="url(#s)"/>';
  [[560, '#0d3d6b', .55], [650, '#082b4d', .8], [740, '#061f38', 1]].forEach(([b, c, op]) => { for (let x = -30; x < 1630;) { const w = 70 + rnd() * 100, h = 140 + rnd() * 230; o += `<rect x="${x}" y="${b - h + (b - 560)}" width="${w}" height="${h + 300}" fill="${c}" opacity="${op}"/><rect x="${x}" y="${b - h + (b - 560)}" width="${w}" height="${h + 300}" fill="url(#w)" opacity="${op}"/>`; x += w + rnd() * 14; } });
  o += '<path d="M0 870 L260 800 L520 740 L800 650 L1080 560 L1360 430 L1600 330" fill="none" stroke="#f5a623" stroke-width="5" stroke-dasharray="14 12" opacity=".6"/><circle cx="1360" cy="430" r="9" fill="#f5a623"/><circle cx="800" cy="650" r="9" fill="#f5a623"/><circle cx="260" cy="800" r="9" fill="#f5a623"/></svg>';
  return "data:image/svg+xml," + encodeURIComponent(o);
})();
function landing() {
  const F6 = [["list", "Requirements Checklist", "Post required documents with due dates and let students submit each one online."], ["clock", "Hour Logging", "Interns log daily hours with built-in rules: no future dates and a 12-hour daily cap."], ["ok", "Approval Workflow", "Coordinators approve or reject submissions and hours, with remarks on every rejection."], ["chart", "Progress Dashboard", "See every intern's hours, requirements and overall status at a glance."], ["alert", "Overdue Detection", "Late requirements are flagged automatically so nothing slips through."], ["history", "Activity History", "Every action is recorded in an audit trail and exportable as a CSV report."]];
  const HW = [["Post requirements", "The coordinator sets the checklist and deadlines."], ["Submit and log", "Students upload requirement notes and record daily hours."], ["Review and decide", "The coordinator approves or rejects with remarks."], ["Complete", "Status updates automatically until the internship is Completed."]];
  return `<div class="lp"><div class="lhero" style="background-image:linear-gradient(180deg,#06203a88,#06203acc),url('${BG}')"><div class="lnav"><div class="brand"><div class="logo">${ic('cap')}</div><h1>InternTrack<small>INTERNSHIP REQUIREMENTS & PROGRESS MONITORING</small></h1></div><div class="r"><button class="g s" onclick="goTo('features')">Features</button><button class="g s" onclick="goTo('how')">How it works</button><button class="s" onclick="goLogin()">Log in</button></div></div>
<div class="lcopy"><span class="pill">Internship Management System</span><h1 class="big">Track every requirement. Verify every hour. <span>Finish with confidence.</span></h1><p>One place for students and coordinators to manage internship documents, log hours, and monitor progress from the first day to completion.</p><div class="row"><button class="cta" onclick="goLogin()">Get started</button><button class="g cta2" onclick="goTo('features')">Explore features</button></div>
<div class="lstats"><div><b>${PS.students}</b><span>Registered interns</span></div><div><b>${PS.hours}</b><span>Verified internship hours</span></div><div><b>${PS.approved}</b><span>Requirements approved</span></div></div></div></div>
<section id="features"><h2 class="t">Everything you need to monitor an internship</h2><p class="sub">Built for students and internship coordinators.</p><div class="fg">${F6.map(f => `<div class="fc"><div class="fi">${ic(f[0])}</div><h3>${f[1]}</h3><p>${f[2]}</p></div>`).join("")}</div></section>
<section id="how"><h2 class="t">How it works</h2><p class="sub">From requirement to completion in four steps.</p><div class="hw">${HW.map((h, i) => `<div><i>${i + 1}</i><b>${h[0]}</b><p>${h[1]}</p></div>`).join("")}</div></section>
<section><div class="fg"><div class="fc"><div class="fi">${ic('users')}</div><h3>For Students</h3><p>Submit requirements, log your hours, and follow your internship journey with a live progress ring and milestone tracker.</p></div><div class="fc"><div class="fi">${ic('trend')}</div><h3>For Coordinators</h3><p>Manage student accounts, post requirements, review submissions and hours, monitor every intern's progress, and export reports.</p></div></div></section>
<div class="band"><h2>Ready to start tracking your internship?</h2><button class="cta" onclick="goLogin()">Log in to InternTrack</button></div><div class="lfoot">InternTrack &middot; Internship Requirements and Progress Monitoring System</div></div>`;
}

/* ---------- main render ---------- */
const TABS = {
  coordinator: [["dash", "Dashboard", V_dash, "chart"], ["stu", "Students", V_stu, "users"], ["req", "Requirements", V_req, "list"], ["subs", "Submissions", V_subs, "ok"], ["hrs", "Hour Logs", V_hrs, "clock"], ["hist", "History", V_hist, "history"]],
  student: [["prog", "My Progress", V_prog, "trend"], ["req", "Requirements", V_req, "list"], ["subs", "My Submissions", V_subs, "file"], ["hrs", "Hour Log", V_hrs, "clock"], ["hist", "History", V_hist, "history"]]
};
function render(keep) {
  const A = $("#app"); if (!ready) { A.innerHTML = '<main class="card">Loading…</main>'; return; }
  if (!me && !showLogin) { A.innerHTML = landing(); return; }
  if (!me) {
    A.innerHTML = `<div class="auth"><div class="hero"><div class="brand"><div class="logo">${ic('cap')}</div><h1>InternTrack<small>INTERNSHIP REQUIREMENTS & PROGRESS MONITORING</small></h1></div><h1>Your guide from internship to graduation.</h1><ul><li>${ic('file')} Submit your requirements online</li><li>${ic('clock')} Log and verify internship hours</li><li>${ic('trend')} Track your progress until completion</li></ul><svg viewBox="0 0 300 120"><rect x="10" y="60" width="280" height="8" rx="4" fill="#fff4"/><rect x="10" y="60" width="170" height="8" rx="4" fill="#f5a623"/><g fill="#fff"><circle cx="12" cy="64" r="11"/><circle cx="95" cy="64" r="11"/><circle cx="180" cy="64" r="11"/></g><circle cx="288" cy="64" r="11" fill="none" stroke="#fff" stroke-width="3"/><text x="0" y="100" fill="#fff" font-size="11">Requirements</text><text x="100" y="100" fill="#fff" font-size="11">Hours</text><text x="195" y="100" fill="#fff" font-size="11">Report</text></svg></div><div class="form"><div class="box"><button class="g s" onclick="back()">${ic('back')} Back to home</button><h2 style="font-size:22px;margin-top:14px">Welcome back</h2><p class="mu">Log in to continue.</p><p><input id="le" placeholder="Email" style="width:100%"></p><p><input id="lp" type="password" placeholder="Password" style="width:100%" onkeydown="if(event.key=='Enter')login()"></p><button style="width:100%" onclick="login()">Log in</button><div class="err">${msg}</div><div class="demo"><b>Demo accounts</b><br>Coordinator: coordinator@school.edu / Admin@123<br>Student: juan@school.edu / Student@123</div></div></div></div>`;
    return;
  }
  const T = TABS[me.role], v = T.find(t => t[0] == tab) || T[0], f = document.activeElement && document.activeElement.id, co = me.role == "coordinator",
    pc = co ? { subs: S.subs.filter(x => x.status == "Pending").length, hrs: S.hrs.filter(x => x.status == "Pending").length } : { subs: S.subs.filter(x => x.sid == me.id && x.status == "Rejected").length, hrs: S.hrs.filter(x => x.sid == me.id && x.status == "Rejected").length };
  A.innerHTML = `<div class="shell"><div class="scrim ${SO ? "show" : ""}" onclick="SO=0;render()"></div><aside class="side ${SO ? "open" : ""}"><div class="brand sb"><div class="logo">${ic('cap')}</div><h1>InternTrack<small>${me.role.toUpperCase()} PORTAL</small></h1></div><div class="nl">${T.map(t => `<button class="ni ${t[0] == v[0] ? "on" : ""}" onclick="SO=0;go('${t[0]}')">${ic(t[3])} ${t[1]}${pc[t[0]] ? `<em>${pc[t[0]]}</em>` : ""}</button>`).join("")}</div><div class="su"><div class="av">${esc(me.name.trim()[0])}</div><div><b>${esc(me.name)}</b><br>${me.role == "coordinator" ? "Coordinator" : "Student"}</div><button class="g s" title="Log out" onclick="logout()">${ic('out')}</button></div></aside>
 <div class="ct"><div class="tb"><button class="g s mb" onclick="SO=1;render()">${ic('menu')}</button>${stack.length ? `<button class="g s" onclick="back()">${ic('back')} Back</button>` : ""}<h2 class="pt">${v[1]}</h2><div class="qa">${co ? `<button onclick="fm('users')">${ic('plus')} <span>Student</span></button><button class="g" onclick="fm('reqs')">${ic('plus')} <span>Requirement</span></button>` : `<button onclick="fm('hrs')">${ic('plus')} <span>Log hours</span></button><button class="g" onclick="fm('subs')">${ic('plus')} <span>Submit</span></button>`}</div></div><main>${v[2]()}</main></div></div>${M ? `<div class="ov" onclick="if(event.target==this)closeM()"><div class="mod">${M}</div></div>` : ""}`;
  if (keep && f) { const el = document.getElementById(f); if (el) { el.focus(); el.setSelectionRange(1e4, 1e4); } }
}

/* ---------- startup ---------- */
(async () => {
  await loadPublicStats();
  try { me = (await api("/api/me")).user; await load(); tab = me.role == "student" ? "prog" : "dash"; } catch (e) { me = null; }
  ready = true; render();
  setInterval(async () => {
    if (me && !M && document.visibilityState == "visible") {
      try { await load(); render(1); } catch (e) { if (/Unauthorized/.test(e.message)) { me = null; render(); } }
    }
  }, 8000);
})();
