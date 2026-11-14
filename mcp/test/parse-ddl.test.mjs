// Unit tests for deadline timezone parsing (run after `npm run build`).
import { test } from "node:test";
import assert from "node:assert/strict";
import { parseDdl } from "../dist/venues.js";

test("AoE deadlines are UTC-12 (next-day 11:59 UTC for 23:59 AoE)", () => {
  const naive = Date.UTC(2026, 2, 5, 14, 0, 0);
  assert.equal(parseDdl("2026-03-05 14:00:00", "AoE"), naive + 12 * 3600 * 1000);
});

test("missing timezone falls back to AoE", () => {
  const naive = Date.UTC(2026, 2, 5, 14, 0, 0);
  assert.equal(parseDdl("2026-03-05 14:00:00"), naive + 12 * 3600 * 1000);
});

test("explicit UTC label is exact", () => {
  const naive = Date.UTC(2026, 4, 22, 11, 59, 59);
  assert.equal(parseDdl("2026-05-22 11:59:59", "UTC"), naive);
});

test("explicit numeric offset -04:00 is honored", () => {
  const naive = Date.UTC(2026, 4, 3, 23, 59, 59);
  assert.equal(parseDdl("2026-05-03 23:59:59", "-04:00"), naive + 4 * 3600 * 1000);
});

test("IANA zone Asia/Singapore is resolved at the deadline instant", () => {
  const naive = Date.UTC(2026, 4, 3, 23, 59, 59);
  assert.equal(parseDdl("2026-05-03 23:59:59", "Asia/Singapore"), naive - 8 * 3600 * 1000);
});

test("unknown IANA zone falls back to AoE", () => {
  const naive = Date.UTC(2026, 4, 3, 23, 59, 59);
  assert.equal(parseDdl("2026-05-03 23:59:59", "Mars/Olympus"), naive + 12 * 3600 * 1000);
});
