/* Screencast: ConferenceRank live site tour for the MCP/agent blog post.
 * Records 1280x720 webm via Playwright. Run: node screencast.mjs
 */
import { chromium } from "/Users/rkaranjai/.npm/_npx/e41f203b7505f1fb/node_modules/playwright/index.mjs";
import { mkdirSync } from "node:fs";

const OUT = new URL("./", import.meta.url).pathname;
mkdirSync(OUT + "video", { recursive: true });

const BASE = "https://rabimba.github.io/ConferenceRank";
const pause = (ms) => new Promise((r) => setTimeout(r, ms));

const browser = await chromium.launch({ headless: true });
const ctx = await browser.newContext({
  viewport: { width: 1280, height: 720 },
  recordVideo: { dir: OUT + "video", size: { width: 1280, height: 720 } },
  deviceScaleFactor: 2,
});
const page = await ctx.newPage();

// --- Scene 1: home directory -------------------------------------------------
await page.goto(BASE + "/", { waitUntil: "networkidle" });
await pause(2500);
await page.mouse.move(640, 400);
await page.mouse.wheel(0, 500);
await pause(1800);
await page.mouse.wheel(0, -500);
await pause(1200);

// --- Scene 2: deadlines tab, multi-select + abstract toggle -------------------
await page.goto(BASE + "/?tab=deadlines", { waitUntil: "networkidle" });
await pause(3000); // client hydration + countdown render

// multi-select rank chips: A* then A
const aStar = page.getByRole("button", { name: "A* Flagship" });
if (await aStar.count()) { await aStar.click(); await pause(1200); }
const aRank = page.getByRole("button", { name: "A Premier" });
if (await aRank.count()) { await aRank.click(); await pause(1500); }

// abstract mode toggle
const absBtn = page.getByRole("button", { name: /Abstract/ });
if (await absBtn.count()) { await absBtn.click(); await pause(2000); }

await page.mouse.wheel(0, 420);
await pause(1800);
await page.mouse.wheel(0, -420);
await pause(800);

// --- Scene 3: venue suggester ------------------------------------------------
await page.goto(BASE + "/suggest/", { waitUntil: "networkidle" });
await pause(2500);
const ta = page.locator("textarea").first();
if (await ta.count()) {
  await ta.click();
  await ta.pressSequentially(
    "We present a novel KV-cache compression scheme for large language model serving on edge GPUs. Our empirical evaluation across distributed inference clusters shows 2.3x throughput gains with negligible perplexity regression, validated on transformer benchmarks for neural network acceleration.",
    { delay: 8 }
  );
  await pause(1000);
  const btn = page.getByRole("button", { name: /suggest|find|match/i }).first();
  if (await btn.count()) { await btn.click(); await pause(4000); }
  await page.mouse.wheel(0, 400);
  await pause(2500);
}

// --- Scene 4: journal page with SJR history ----------------------------------
await page.goto(BASE + "/journal/acm-computing-surveys/", { waitUntil: "networkidle" });
await pause(3000);
await page.mouse.wheel(0, 500);
await pause(2000);

await ctx.close();
await browser.close();
console.log("video written to blogpost_assets/video/");
