export type Quartile = "Q1" | "Q2" | "Q3" | "Q4";

export interface QuartileEvaluable {
  core_rank?: "A*" | "A" | "B" | "C" | "Unranked" | null;
  sjr?: {
    latest_score?: number | null;
    latest_quartile?: "Q1" | "Q2" | "Q3" | "Q4" | null;
    latest_h_index?: number | null;
    history?: unknown[];
  } | null;
}

export function getJournalQuartile(j: QuartileEvaluable): Quartile | null {
  if (j.sjr?.latest_quartile) {
    return j.sjr.latest_quartile;
  }
  const score = j.sjr?.latest_score;
  if (score == null) return null;
  // Conservative fallback based on SJR distribution
  if (score >= 1.0) return "Q1";
  if (score >= 0.5) return "Q2";
  if (score >= 0.25) return "Q3";
  return "Q4";
}

export function getQuickTakeVerdict(j: QuartileEvaluable): string {
  if (j.core_rank === "A*") {
    return "Flagship international journal. Top-tier scholarly prestige with high global impact and selectivity.";
  }
  if (j.core_rank === "A") {
    return "Premier academic journal. Strong peer review, high citation visibility, and respected scholarly standards.";
  }
  if (j.core_rank === "B") {
    return "Established international journal with solid peer-review and indexed research contributions.";
  }
  if (j.core_rank === "C") {
    return "Recognized academic journal meeting baseline scholarly peer-review criteria.";
  }
  const q = getJournalQuartile(j);
  if (q === "Q1") {
    return "High-impact scholarly journal with premier SCImago Q1 citation metrics.";
  }
  if (q === "Q2") {
    return "Well-regarded international journal with solid SCImago Q2 citation ranking.";
  }
  return "Peer-reviewed academic journal in scientific and technical research domains.";
}
