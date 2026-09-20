import test, { describe, it } from "node:test";
import assert from "node:assert";
import journalsJson from "../data/journals.json" with { type: "json" };
import type { Journal } from "./journal-types";

// Test accessors logic directly against data import to ensure correctness under Node test runner
const journals = journalsJson as unknown as Journal[];

function getJournals(): Journal[] {
  return journals;
}

function getJournalById(id: string): Journal | undefined {
  return journals.find((j) => j.id === id);
}

function getAllJournalCategories(): string[] {
  const cats = new Set<string>();
  for (const j of journals) {
    for (const c of j.categories) {
      cats.add(c);
    }
  }
  return Array.from(cats).sort();
}

describe("journal-data", () => {
  it("loads non-empty list of journals", () => {
    const list = getJournals();
    assert.ok(list.length > 0);
  });

  it("finds a journal by id", () => {
    const list = getJournals();
    const first = list[0];
    const found = getJournalById(first.id);
    assert.ok(found !== undefined);
    assert.strictEqual(found?.title, first.title);
  });

  it("extracts unique sorted categories", () => {
    const cats = getAllJournalCategories();
    assert.ok(cats.length > 0);
    const sorted = [...cats].sort();
    assert.deepStrictEqual(cats, sorted);
  });
});
