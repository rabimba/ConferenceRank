/**
 * Build-time generator for the ConferenceRank static JSON API.
 *
 * Emits machine-readable artifacts into public/api/ so AI agents (or any
 * HTTP client) can consume the dataset without scraping the HTML UI:
 *
 *   api/index.json                  manifest: version, generatedAt, endpoints, counts
 *   api/conferences.json            all conferences (full records, incl. deadlines/stats)
 *   api/conference/{id}.json        one conference per file
 *   api/journals-index.json         slim journal records (no history/openalex)
 *   api/journals/{letter}.json      journals chunked by first letter of id (full records)
 *   api/deadlines.json              upcoming deadlines only (flattened, with venue info)
 *
 * Run: npx tsx scripts/build-api.ts   (hooked into `npm run build`)
 */
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import conferences from "../src/data/conferences.json" with { type: "json" };
import journals from "../src/data/journals.json" with { type: "json" };

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const API = path.join(__dirname, "..", "public", "api");

interface ConferenceDeadline {
  cycle?: string | null;
  year: number;
  abstract_deadline?: string | null;
  paper_deadline: string;
  notification_date?: string | null;
  timezone: string;
  location?: string | null;
  conference_dates?: string | null;
  cfp_url?: string | null;
  source?: string;
}

interface ConferenceRecord {
  id: string;
  title: string;
  acronym: string;
  rank: string;
  categories: string[];
  deadlines?: ConferenceDeadline[] | null;
  [k: string]: unknown;
}

interface JournalRecord {
  id: string;
  title: string;
  acronym: string | null;
  core_rank: string | null;
  categories: string[];
  sjr: { latest_score: number | null; latest_quartile?: string | null; latest_h_index: number | null } | null;
  is_oa: boolean;
  publisher: string | null;
  issn: string[];
  [k: string]: unknown;
}

const confs = conferences as unknown as ConferenceRecord[];
const jrns = journals as unknown as JournalRecord[];

function write(rel: string, data: unknown) {
  const p = path.join(API, rel);
  mkdirSync(path.dirname(p), { recursive: true });
  writeFileSync(p, JSON.stringify(data));
}

function slugSafe(id: string): string {
  // ids are already URL-safe slugs (conferences numeric, journals slugged)
  return encodeURIComponent(id);
}

// --- conferences -----------------------------------------------------------
write("conferences.json", confs);
for (const c of confs) write(`conference/${slugSafe(c.id)}.json`, c);

// --- journals --------------------------------------------------------------
const journalIndex = jrns.map((j) => ({
  id: j.id,
  title: j.title,
  acronym: j.acronym,
  core_rank: j.core_rank,
  sjr_score: j.sjr?.latest_score ?? null,
  sjr_quartile: j.sjr?.latest_quartile ?? null,
  h_index: j.sjr?.latest_h_index ?? null,
  is_oa: j.is_oa,
  categories: j.categories,
  publisher: j.publisher,
  issn: j.issn,
}));
write("journals-index.json", journalIndex);

// chunk by first alphanumeric character of id (a-z, 0-9, other); chunks carry
// FULL journal records so agents can fetch one letter and get everything.
const chunks = new Map<string, JournalRecord[]>();
for (const j of jrns) {
  const first = (j.id[0] ?? "x").toLowerCase();
  const key = /[a-z0-9]/.test(first) ? first : "other";
  if (!chunks.has(key)) chunks.set(key, []);
  chunks.get(key)!.push(j);
}
for (const [key, list] of chunks) write(`journals/${key}.json`, list);

// --- deadlines (upcoming only, flattened) -----------------------------------
function parseDdl(s: string | null | undefined): number {
  if (!s) return NaN;
  const m = s.trim().match(/^(\d{4})-(\d{2})-(\d{2})(?:[ T](\d{2}):(\d{2})(?::(\d{2}))?)?/);
  if (!m) return NaN;
  const [, y, mo, d, h = "23", mi = "59", sec = "59"] = m;
  // Deadlines are nominally AoE (UTC-12) unless specified; UTC parse is a
  // consistent approximation for "upcoming" filtering.
  return Date.UTC(+y, +mo - 1, +d, +h, +mi, +sec);
}

const now = Date.now();
const PAST_GRACE_MS = 60 * 24 * 3600 * 1000; // keep recently-passed 60d
const upcoming: unknown[] = [];
for (const c of confs) {
  if (!c.deadlines) continue;
  for (const d of c.deadlines) {
    const ts = parseDdl(d.paper_deadline);
    if (isNaN(ts) || ts < now - PAST_GRACE_MS) continue;
    upcoming.push({
      venue_id: c.id,
      acronym: c.acronym,
      title: c.title,
      rank: c.rank,
      categories: c.categories,
      ...d,
    });
  }
}
upcoming.sort((a, b) => {
  const ta = parseDdl((a as { paper_deadline: string }).paper_deadline);
  const tb = parseDdl((b as { paper_deadline: string }).paper_deadline);
  return ta - tb;
});
write("deadlines.json", upcoming);

// --- manifest ---------------------------------------------------------------
write("index.json", {
  name: "ConferenceRank Static API",
  version: 1,
  generatedAt: new Date().toISOString(),
  baseUrl: "https://rabimba.github.io/ConferenceRank/api",
  endpoints: {
    conferences: "conferences.json",
    conference_by_id: "conference/{id}.json",
    journals_index: "journals-index.json",
    journals_chunk: "journals/{letter}.json (full records, keyed by first letter of id; find a journal's chunk via journals-index.json)",
    deadlines: "deadlines.json",
  },
  counts: {
    conferences: confs.length,
    journals: jrns.length,
    deadlines: upcoming.length,
    journal_chunks: chunks.size,
  },
  license: "Apache-2.0 (code); rank data © CORE, journal indicators © SCImago Lab/Scopus (CC BY-NC-SA 4.0)",
});

console.log(
  `[build-api] conferences=${confs.length} journals=${jrns.length} ` +
    `deadlines=${upcoming.length} journal_chunks=${chunks.size}`
);
