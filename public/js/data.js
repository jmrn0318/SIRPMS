/* InternTrack – DATA layer: app state, API client, and derived data (progress/status).
   Loaded first. No HTML or styling here. */

// Data fetched from the server (role-scoped by /api/data)
const S = { users: [], reqs: [], subs: [], hrs: [], hist: [] };

// Session + UI state
let me = null, tab = "", msg = "", F = {}, ready = false, showLogin = false, stack = [], SO = 0, M = "";
let PS = { students: 0, hours: 0, approved: 0 }; // public landing-page stats

// Constants
const ST = ["Pending", "Approved", "Rejected"];
const EP = { users: "students", reqs: "requirements", subs: "submissions", hrs: "hours" }; // collection -> API path
const NM = { users: "Student", reqs: "Requirement", subs: "Submission", hrs: "Hour Log" };

// Small helpers
const $ = s => document.querySelector(s);
const today = () => new Date().toISOString().slice(0, 10);
const esc = s => String(s ?? "").replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const U = i => S.users.find(u => u.id == i) || { name: "?" };
const R = i => S.reqs.find(r => r.id == i) || { title: "?" };

// API client (talks to the Express backend)
const api = async (u, m = "GET", b) => {
  const r = await fetch(u, { method: m, headers: { "Content-Type": "application/json" }, credentials: "same-origin", body: b ? JSON.stringify(b) : undefined });
  let j = {}; try { j = await r.json(); } catch (e) {}
  if (!r.ok) throw new Error(j.error || "Request failed");
  return j;
};
async function load() { Object.assign(S, await api("/api/data")); }
async function loadPublicStats() { try { PS = await api("/api/public-stats"); } catch (e) {} }

// Derived data: a student's progress and automatic internship status
function prog(u) {
  const rs = S.reqs.filter(r => r.active !== false),
    ap = S.subs.filter(s => s.sid == u.id && s.status == "Approved" && rs.some(r => r.id == s.rid)).length,
    hrs = S.hrs.filter(h => h.sid == u.id && h.status == "Approved").reduce((a, h) => a + h.hrs, 0),
    od = rs.filter(r => r.due < today() && !S.subs.some(s => s.sid == u.id && s.rid == r.id && s.status == "Approved")).length;
  const done = hrs >= u.need && ap == rs.length && rs.length > 0,
    st = done ? "Completed" : (hrs || ap || S.subs.some(s => s.sid == u.id)) ? "In Progress" : "Not Started";
  return { ap, tot: rs.length, hrs, od, st, pct: Math.min(100, Math.round(((u.need ? Math.min(hrs / u.need, 1) : 0) + (rs.length ? ap / rs.length : 0)) * 50)) };
}

// List helper: search + status filter + sort for the BREAD tables
function lst(k, arr, sorts) {
  const q = (F[k + "q"] || "").toLowerCase(), st = F[k + "s"] || "",
    o = sorts.find(x => x[0] == (F[k + "o"] || sorts[0][0])) || sorts[0];
  return arr.filter(x => (!st || x.status == st) && (!q || JSON.stringify(x).toLowerCase().includes(q))).sort(o[2]);
}
