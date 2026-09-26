// Minimal stdio MCP handshake + tool calls, no client SDK needed.
import { spawn } from "node:child_process";

const env = {
  ...process.env,
  CONFERENCERANK_API_BASE: "http://localhost:8899/api",
  CONFERENCERANK_CACHE_DIR: "/tmp/cr-mcp-cache",
};

const srv = spawn("node", ["dist/index.js"], { env, stdio: ["pipe", "pipe", "inherit"] });
let buf = "";
const pending = new Map();
let idc = 0;

srv.stdout.on("data", (chunk) => {
  buf += chunk.toString();
  let idx;
  while ((idx = buf.indexOf("\n")) >= 0) {
    const line = buf.slice(0, idx).trim();
    buf = buf.slice(idx + 1);
    if (!line) continue;
    try {
      const msg = JSON.parse(line);
      if (msg.id !== undefined && pending.has(msg.id)) {
        pending.get(msg.id)(msg);
        pending.delete(msg.id);
      }
    } catch { /* ignore */ }
  }
});

function send(method, params) {
  const id = ++idc;
  srv.stdin.write(JSON.stringify({ jsonrpc: "2.0", id, method, params }) + "\n");
  return new Promise((res) => pending.set(id, res));
}
const notify = (method, params) => srv.stdin.write(JSON.stringify({ jsonrpc: "2.0", method, params }) + "\n");

const init = await send("initialize", {
  protocolVersion: "2024-11-05",
  capabilities: {},
  clientInfo: { name: "smoke", version: "0.0.1" },
});
console.log("1. init ok:", init.result?.serverInfo?.name === "conferencerank");
notify("notifications/initialized", {});

const tools = await send("tools/list", {});
console.log("2. tools:", tools.result.tools.map((t) => t.name).join(", "));

const call = (name, args) => send("tools/call", { name, arguments: args });

const s = await call("search_venues", { query: "SOSP", type: "conference" });
const sData = JSON.parse(s.result.content[0].text);
console.log("3. search SOSP:", sData.results[0]?.acronym, "rank", sData.results[0]?.rank);

const sug = await call("suggest_venues", {
  abstract: "We present a novel transformer architecture for large language model serving with quantization and KV cache optimization. Our empirical evaluation on GPU clusters shows significant throughput improvements for inference workloads in distributed systems and machine learning applications, with extensive benchmarks on attention mechanisms and neural network acceleration.",
  type: "all", topN: 5,
});
const sugData = JSON.parse(sug.result.content[0].text);
console.log("4. suggest top3:", sugData.suggestions.slice(0,3).map(x => `${x.venue.acronym || x.venue.id}(${x.matchPercentage}%)`).join(", "), "| confidence:", sugData.confidence);

const dl = await call("upcoming_deadlines", { windowDays: 365, deadlineType: "abstract" });
const dlData = JSON.parse(dl.result.content[0].text);
console.log("5. abstract deadlines (365d):", dlData.count, "first:", dlData.deadlines[0]?.acronym, dlData.deadlines[0]?.deadline);

const cmp = await call("compare_venues", { ids: ["711", "acm-computing-surveys"] });
const cmpData = JSON.parse(cmp.result.content[0].text);
console.log("6. compare found:", cmpData.venues.map(v => v.acronym ?? v.error).join(" vs "));

srv.kill();
