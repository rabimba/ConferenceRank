import test, { describe, it } from "node:test";
import assert from "node:assert";
import { getJournals, getJournalById, getAllJournalCategories } from "./journal-data.ts";

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
