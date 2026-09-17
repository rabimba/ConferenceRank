/** Single source for rank ordering and weights.
 *  Component style maps (RankBadge, AcceptanceLandscape) stay local —
 *  their class shapes differ by context. */

/** Sort order (lower = better). Unlisted ranks sort last. */
export const RANK_ORDER: Record<string, number> = {
  "A*": 1,
  A: 2,
  B: 3,
  "Australasian B": 4,
  C: 5,
  "Australasian C": 6,
};

/** Prestige weight for trend/upgrade comparisons (higher = better). */
export const RANK_WEIGHT: Record<string, number> = {
  "A*": 4,
  A: 3,
  B: 2,
  "Australasian B": 2,
  C: 1,
  "Australasian C": 1,
};

export function rankOrder(rank: string): number {
  return RANK_ORDER[rank] ?? 90;
}

export function rankWeight(rank: string): number {
  return RANK_WEIGHT[rank] ?? 0;
}
