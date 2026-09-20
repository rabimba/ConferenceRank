import journalsJson from "@/data/journals.json";
import { Journal } from "./journal-types";

const journals = journalsJson as unknown as Journal[];

export function getJournals(): Journal[] {
  return journals;
}

export function getJournalById(id: string): Journal | undefined {
  return journals.find((j) => j.id === id);
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
