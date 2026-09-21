import fs from "fs";
import path from "path";
import type { Journal } from "./journal-types";

function validateJournal(raw: unknown, idx: number): Journal {
  if (!raw || typeof raw !== "object") {
    throw new Error(`Invalid journal record at index ${idx}: expected object`);
  }
  const r = raw as Record<string, unknown>;
  if (typeof r.id !== "string" || !r.id) {
    throw new Error(`Invalid journal record at index ${idx}: missing or non-string 'id'`);
  }
  if (typeof r.title !== "string" || !r.title) {
    throw new Error(`Invalid journal record ${r.id}: missing or non-string 'title'`);
  }
  if (!Array.isArray(r.categories)) {
    throw new Error(`Invalid journal record ${r.id}: 'categories' must be an array`);
  }
  if (!Array.isArray(r.issn)) {
    throw new Error(`Invalid journal record ${r.id}: 'issn' must be an array`);
  }
  return r as unknown as Journal;
}

let cached: Journal[] | null = null;
let byId: Map<string, Journal> | null = null;
let categoriesCache: string[] | null = null;

function loadJournals(): Journal[] {
  if (cached) return cached;
  // Node.js fs read prevents client bundling (browser bundlers will fail or mock fs if mistakenly imported in client)
  const p = path.join(process.cwd(), "src", "data", "journals.json");
  let raw: string;
  try {
    raw = fs.readFileSync(p, "utf8");
  } catch {
    // Also support when run from project root
    const fallback = path.join(process.cwd(), "conf-rank", "src", "data", "journals.json");
    try {
      raw = fs.readFileSync(fallback, "utf8");
    } catch {
      throw new Error(`journals.json not found at ${p} or ${fallback} — run scraper/merge_journals.py first`);
    }
  }
  try {
    const rawList = JSON.parse(raw) as unknown[];
    cached = rawList.map((j, i) => validateJournal(j, i));
  } catch (e) {
    throw new Error(`journals.json is malformed: ${(e as Error).message}`);
  }
  return cached;
}

export function getJournals(): Journal[] {
  return loadJournals();
}

export function getJournalById(id: string): Journal | undefined {
  if (!byId) {
    const map = new Map<string, Journal>();
    for (const j of getJournals()) {
      if (process.env.NODE_ENV !== "production" && map.has(j.id)) {
        console.warn(`[journal-data] Duplicate journal id detected: '${j.id}'`);
      }
      map.set(j.id, j);
    }
    byId = map;
  }
  return byId.get(id);
}

export function getAllJournalCategories(): string[] {
  if (categoriesCache) {
    return categoriesCache;
  }
  const cats = new Set<string>();
  for (const j of getJournals()) {
    for (const c of j.categories) {
      cats.add(c);
    }
  }
  categoriesCache = Array.from(cats).sort();
  return categoriesCache;
}
