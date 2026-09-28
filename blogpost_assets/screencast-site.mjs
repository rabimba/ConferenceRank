/* Screencast for the launch post: general ConferenceRank site walkthrough.
 * Scenes: home directory -> rank chips -> conference detail (acceptance chart)
 * -> journals directory (dual badges) -> deadlines tab -> suggester.
 * Run: node screencast-site.mjs
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

// Scene 1: home — hero, rising venues, directory table
await page.goto(BASE + "/", { waitUntil: "networkidle" });
await pause(2500);
await page.mouse.wheel(0, 450);
await pause(1600);
await page.mouse.wheel(0, -450);
await pause(1000);

// Scene 2: filter by A* rank chip
const aStarChip = page.getByRole("button", { name: /^A\*$/ }).first();
if (await aStarChip.count()) { await aStarChip.click(); await pause(1800); }
await page.mouse.wheel(0, 350);
await pause(1500);

// Scene 3: open a conference detail (SOSP) — acceptance history chart
await page.goto(BASE + "/conference/48/", { waitUntil: "networkidle" });
await pause(2800);
await page.mouse.wheel(0, 500);
await pause(2000);
await page.mouse.wheel(0, 400);
await pause(1800);

// Scene 4: journals directory — dual badges + quartile filter
await page.goto(BASE + "/journals/", { waitUntil: "networkidle" });
await pause(3000);
await page.mouse.wheel(0, 400);
await pause(1800);
const q1 = page.getByRole("button", { name: /Q1/ }).first();
if (await q1.count()) { await q1.click(); await pause(1800); }

// Scene 5: deadlines tab overview
await page.goto(BASE + "/?tab=deadlines", { waitUntil: "networkidle" });
await pause(3200);
await page.mouse.wheel(0, 400);
await pause(1800);

// Scene 6: suggester with abstract
await page.goto(BASE + "/suggest/", { waitUntil: "networkidle" });
await pause(2500);
const ta = page.locator("textarea").first();
if (await ta.count()) {
  await ta.click();
  await ta.pressSequentially(
    "We present a formally verified consensus protocol for distributed systems, with a machine-checked safety proof in TLA+ and an empirical evaluation of latency under Byzantine faults on a geo-replicated cluster.",
    { delay: 8 }
  );
  await pause(900);
  const btn = page.getByRole("button", { name: /suggest|find|match/i }).first();
  if (await btn.count()) { await btn.click(); await pause(4200); }
  await page.mouse.wheel(0, 380);
  await pause(2400);
}

await ctx.close();
await browser.close();
console.log("site walkthrough video written");
