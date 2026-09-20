import journalsJson from "../data/journals.json" with { type: "json" };
import type { Journal } from "./journal-types";

const journals = journalsJson as unknown as Journal[];
let byId: Map<string, Journal> | null = null;

export function getJournals(): Journal[] {
  return journals;
}

export function getJournalById(id: string): Journal | undefined {
  if (!byId) byId = new Map(journals.map((j) => [j.id, j]));
  return byId.get(id);
}

export function getAllJournalCategories(): string[] {
  const cats = new Set<string>();
  for (const j of journals) {
    for (const c of j.categories) {
      cats.add(c);
    }
  }
  return Array.from(cats).sort();
}
