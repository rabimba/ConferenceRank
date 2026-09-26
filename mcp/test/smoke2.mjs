import { spawn } from "node:child_process";
const env = { ...process.env, CONFERENCERANK_API_BASE: "http://localhost:8899/api", CONFERENCERANK_CACHE_DIR: "/tmp/cr-mcp-cache" };
const srv = spawn("node", ["dist/index.js"], { env, stdio: ["pipe", "pipe", "inherit"] });
let buf = ""; const pending = new Map(); let idc = 0;
srv.stdout.on("data", (ch) => { buf += ch.toString(); let i; while ((i = buf.indexOf("\n")) >= 0) { const l = buf.slice(0, i).trim(); buf = buf.slice(i + 1); if (!l) continue; try { const m = JSON.parse(l); if (m.id !== undefined && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); } } catch {} } });
function send(method, params) { const id = ++idc; srv.stdin.write(JSON.stringify({ jsonrpc: "2.0", id, method, params }) + "\n"); return new Promise((r) => pending.set(id, r)); }
const notify = (m, p) => srv.stdin.write(JSON.stringify({ jsonrpc: "2.0", method: m, params: p }) + "\n");
await send("initialize", { protocolVersion: "2024-11-05", capabilities: {}, clientInfo: { name: "smoke", version: "0" } });
notify("notifications/initialized", {});
const call = (name, args) => send("tools/call", { name, arguments: args });

const g = await call("get_venue", { id: "acm-computing-surveys" });
const gd = JSON.parse(g.result.content[0].text);
console.log("1. journal get:", gd.found, gd.venue?.acronym ?? gd.venue?.title?.slice(0,40), "| core:", gd.venue?.core_rank, "sjr hist yrs:", gd.venue?.sjr_history?.length);

const g2 = await call("get_venue", { id: "48" });
const g2d = JSON.parse(g2.result.content[0].text);
console.log("2. conf get:", g2d.venue?.acronym, g2d.venue?.rank, "| stats yrs:", g2d.venue?.stats?.length, "| deadlines:", g2d.venue?.upcoming_deadlines?.length);

const cmp = await call("compare_venues", { ids: ["48", "acm-computing-surveys"] });
const cd = JSON.parse(cmp.result.content[0].text);
console.log("3. compare:", cd.venues.map(v => v.acronym ?? v.title?.slice(0,30) ?? v.error).join(" vs "));

const st = await call("acceptance_stats", { id: "48" });
const sd = JSON.parse(st.result.content[0].text);
console.log("4. stats:", sd.found, sd.acronym, "years:", sd.years, "latest:", JSON.stringify(sd.stats?.at(-1)));

// offline fallback: kill server scenario simulated via bad base after cache warm
srv.kill();
