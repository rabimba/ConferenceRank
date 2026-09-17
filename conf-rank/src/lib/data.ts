import fs from "fs";
import path from "path";
import type { Conference } from "./types";

let cached: Conference[] | null = null;

export function getConferences(): Conference[] {
  if (cached) return cached;
  const p = path.join(process.cwd(), "src", "data", "conferences.json");
  cached = JSON.parse(fs.readFileSync(p, "utf8")) as Conference[];
  return cached;
}

export function getConference(id: string): Conference | undefined {
  return getConferences().find((c) => c.id === id);
}

export function searchConferences(q: string, limit = 20): Conference[] {
  const query = q.toLowerCase().trim();
  if (!query) return [];
  const list = getConferences();
  const startsWith: Conference[] = [];
  const contains: Conference[] = [];
  for (const c of list) {
    const acr = c.acronym.toLowerCase();
    const title = c.title.toLowerCase();
    if (acr.startsWith(query)) startsWith.push(c);
    else if (acr.includes(query) || title.includes(query)) contains.push(c);
  }
  return [...startsWith, ...contains].slice(0, limit);
}
