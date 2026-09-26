/**
 * Data layer: fetches the ConferenceRank static JSON API and caches it under
 * ~/.cache/conferencerank/. Revalidates against the remote manifest's
 * generatedAt timestamp; falls back to stale cache when offline.
 *
 * Env overrides:
 *   CONFERENCERANK_API_BASE — alternate API base URL (testing/mirrors)
 *   CONFERENCERANK_CACHE_DIR — alternate cache directory
 */
import { mkdirSync, readFileSync, writeFileSync, existsSync } from "node:fs";
import { homedir } from "node:os";
import path from "node:path";

export const API_BASE =
  process.env.CONFERENCERANK_API_BASE ??
  "https://rabimba.github.io/ConferenceRank/api";

const CACHE_DIR =
  process.env.CONFERENCERANK_CACHE_DIR ??
  path.join(homedir(), ".cache", "conferencerank");

export interface ApiManifest {
  name: string;
  version: number;
  generatedAt: string;
  baseUrl: string;
  endpoints: Record<string, string>;
  counts: Record<string, number>;
  license: string;
}

export interface ConferenceDeadline {
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

export interface YearStat {
  year: number;
  accepted?: number | null;
  submitted?: number | null;
  rate?: number | null;
  [k: string]: unknown;
}

export interface Conference {
  id: string;
  title: string;
  acronym: string;
  rank: string;
  for_codes: string[];
  categories: string[];
  rank_history: { source: string; rank: string; [k: string]: unknown }[];
  stats: YearStat[] | null;
  stats_source: string | null;
  deadlines?: ConferenceDeadline[] | null;
  openalex?: { topics?: { name: string; share: number }[]; [k: string]: unknown };
  [k: string]: unknown;
}

export interface JournalIndexEntry {
  id: string;
  title: string;
  acronym: string | null;
  core_rank: string | null;
  sjr_score: number | null;
  sjr_quartile: string | null;
  h_index: number | null;
  is_oa: boolean;
  categories: string[];
  publisher: string | null;
  issn: string[];
}

export interface Journal extends Omit<JournalIndexEntry, "sjr_score" | "sjr_quartile" | "h_index"> {
  core_rank_history: { source: string; rank: string; [k: string]: unknown }[];
  sjr: {
    latest_score: number | null;
    latest_quartile?: string | null;
    latest_h_index: number | null;
    history: { year: number; sjr: number | null; quartile?: string; h_index: number | null }[];
  } | null;
  country: string | null;
  dblp_url: string | null;
  openalex?: { topics?: { name: string; share: number }[]; [k: string]: unknown };
  [k: string]: unknown;
}

export interface DeadlineEntry extends ConferenceDeadline {
  venue_id: string;
  acronym: string;
  title: string;
  rank: string;
  categories: string[];
}

const META_FILE = path.join(CACHE_DIR, "meta.json");

function cachePath(name: string): string {
  return path.join(CACHE_DIR, name.replace(/\//g, "__"));
}

async function fetchJson(url: string): Promise<unknown> {
  const res = await fetch(url, {
    headers: { "User-Agent": "conferencerank-mcp/0.1 (+https://github.com/rabimba/ConferenceRank)" },
    signal: AbortSignal.timeout(60_000),
  });
  if (!res.ok) throw new Error(`GET ${url} -> ${res.status}`);
  return res.json();
}

function readCached<T>(name: string): T | null {
  const p = cachePath(name);
  if (!existsSync(p)) return null;
  try {
    return JSON.parse(readFileSync(p, "utf-8")) as T;
  } catch {
    return null;
  }
}

function writeCached(name: string, data: unknown): void {
  mkdirSync(CACHE_DIR, { recursive: true });
  writeFileSync(cachePath(name), JSON.stringify(data));
}

function readMeta(): { generatedAt: string } | null {
  try {
    return JSON.parse(readFileSync(META_FILE, "utf-8"));
  } catch {
    return null;
  }
}

/** True if remote manifest is newer than our cached snapshot. */
async function remoteIsNewer(): Promise<boolean> {
  try {
    const manifest = (await fetchJson(`${API_BASE}/index.json`)) as ApiManifest;
    const meta = readMeta();
    return !meta || meta.generatedAt !== manifest.generatedAt;
  } catch {
    return false; // offline or unreachable — keep whatever cache we have
  }
}

async function loadJson<T>(name: string, fresh: boolean): Promise<T> {
  if (!fresh) {
    const cached = readCached<T>(name);
    if (cached !== null) return cached;
  }
  try {
    const data = await fetchJson(`${API_BASE}/${name}`);
    writeCached(name, data);
    return data as T;
  } catch (err) {
    const cached = readCached<T>(name);
    if (cached !== null) return cached; // stale beats nothing
    throw err;
  }
}

let stampFresh: boolean | null = null;

async function ensureFresh(): Promise<boolean> {
  if (stampFresh === null) stampFresh = await remoteIsNewer();
  return stampFresh;
}

function chunkKeyFor(id: string): string {
  const first = (id[0] ?? "x").toLowerCase();
  return /[a-z0-9]/.test(first) ? first : "other";
}

/** Load all conferences (cached). */
export async function getConferences(): Promise<Conference[]> {
  return loadJson<Conference[]>("conferences.json", await ensureFresh());
}

/** Load upcoming flattened deadlines (cached). */
export async function getDeadlines(): Promise<DeadlineEntry[]> {
  return loadJson<DeadlineEntry[]>("deadlines.json", await ensureFresh());
}

/** Load the slim journal index (cached). */
export async function getJournalIndex(): Promise<JournalIndexEntry[]> {
  return loadJson<JournalIndexEntry[]>("journals-index.json", await ensureFresh());
}

/** Load full records for one letter-chunk of journals (cached per letter). */
export async function getJournalChunk(letter: string): Promise<Journal[]> {
  const key = chunkKeyFor(letter);
  return loadJson<Journal[]>(`journals/${key}.json`, await ensureFresh());
}

/** Full journal record by id (resolves via index, then letter chunk). */
export async function getJournal(id: string): Promise<Journal | undefined> {
  const chunk = await getJournalChunk(id);
  return chunk.find((j) => j.id === id);
}

/** Persist manifest timestamp after a successful refresh cycle. */
export async function stampCache(): Promise<void> {
  try {
    const manifest = (await fetchJson(`${API_BASE}/index.json`)) as ApiManifest;
    mkdirSync(CACHE_DIR, { recursive: true });
    writeFileSync(META_FILE, JSON.stringify({ generatedAt: manifest.generatedAt }));
    stampFresh = false;
  } catch {
    /* best-effort */
  }
}
