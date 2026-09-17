import fs from "fs";
import path from "path";
import type { Conference } from "./types";

let cached: Conference[] | null = null;
let byId: Map<string, Conference> | null = null;

export function getConferences(): Conference[] {
  if (cached) return cached;
  const p = path.join(process.cwd(), "src", "data", "conferences.json");
  let raw: string;
  try {
    raw = fs.readFileSync(p, "utf8");
  } catch {
    throw new Error(`conferences.json not found at ${p} — run scraper/merge.py first`);
  }
  try {
    cached = JSON.parse(raw) as Conference[];
  } catch (e) {
    throw new Error(`conferences.json is malformed: ${(e as Error).message}`);
  }
  return cached;
}

export function getConference(id: string): Conference | undefined {
  if (!byId) byId = new Map(getConferences().map((c) => [c.id, c]));
  return byId.get(id);
}
