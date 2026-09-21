import { describe, it } from "node:test";
import assert from "node:assert";
import { getJournals, getJournalById, getAllJournalCategories } from "./journal-data.ts";
import { getJournalQuartile, getQuickTakeVerdict } from "./quartile.ts";

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

  it("returns undefined for unknown journal id", () => {
    const found = getJournalById("non-existent-journal-xyz-12345");
    assert.strictEqual(found, undefined);
  });

  it("extracts unique sorted categories", () => {
    const cats = getAllJournalCategories();
    assert.ok(cats.length > 0);
    const sorted = [...cats].sort();
    assert.deepStrictEqual(cats, sorted);
  });
});

describe("quartile helpers", () => {
  it("prioritizes latest_quartile from SJR", () => {
    const q = getJournalQuartile({
      sjr: {
        latest_score: 0.1,
        latest_quartile: "Q1",
        latest_h_index: 50,
        history: [],
      },
    });
    assert.strictEqual(q, "Q1");
  });

  it("falls back to score cutoffs when latest_quartile is missing", () => {
    const q1 = getJournalQuartile({ sjr: { latest_score: 1.5, latest_h_index: 50, history: [] } });
    assert.strictEqual(q1, "Q1");
    const q2 = getJournalQuartile({ sjr: { latest_score: 0.8, latest_h_index: 50, history: [] } });
    assert.strictEqual(q2, "Q2");
    const q3 = getJournalQuartile({ sjr: { latest_score: 0.3, latest_h_index: 50, history: [] } });
    assert.strictEqual(q3, "Q3");
    const q4 = getJournalQuartile({ sjr: { latest_score: 0.1, latest_h_index: 50, history: [] } });
    assert.strictEqual(q4, "Q4");
    const none = getJournalQuartile({ sjr: null });
    assert.strictEqual(none, null);
  });

  it("generates correct quick take verdicts", () => {
    assert.ok(getQuickTakeVerdict({ core_rank: "A*" }).includes("Flagship"));
    assert.ok(getQuickTakeVerdict({ core_rank: "A" }).includes("Premier"));
    assert.ok(getQuickTakeVerdict({ core_rank: null, sjr: { latest_score: 2.0, latest_quartile: "Q1", latest_h_index: 100, history: [] } }).includes("Q1"));
  });
});
