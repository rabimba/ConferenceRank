import type { Conference } from "./types";

export interface LatestStat {
  rate: number | null;
  accepted: number | null;
  year: number | null;
}

/**
 * Most recent valid acceptance rate (0 < rate < 60) plus the accepted-paper
 * count from the newest year that has one. Single source of truth for
 * directory, landscape, suggest pages.
 */
export function latestStat(c: Conference): LatestStat {
  if (!c.stats || !c.stats.length) return { rate: null, accepted: null, year: null };
  const sorted = [...c.stats].sort((a, b) => b.year - a.year);
  let rate: number | null = null;
  let year: number | null = null;
  for (const s of sorted) {
    if (s.rate && s.rate > 0 && s.rate < 60) {
      rate = s.rate;
      year = s.year;
      break;
    }
  }
  const accepted = sorted[0].accepted ?? sorted[0].accepted_short ?? null;
  return { rate, accepted, year };
}
