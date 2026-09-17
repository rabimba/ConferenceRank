export interface RankHistoryEntry {
  source: string;
  year: number | null;
  rank: string;
  for?: string;
}

export interface YearStat {
  year: number;
  total?: number;
  accepted?: number;
  rate?: number;
  reject?: number;
  location?: string;
  tiers?: Record<string, number>;
  note?: string;
  rate_short?: number;
  accepted_short?: number;
  submitted_short?: number;
  submitted?: number;
}

export interface TopicShare {
  name: string;
  share: number;
}

export interface InstitutionCount {
  name: string;
  count: number;
}

export interface OpenAlexData {
  source_ids: string[];
  works_per_year: Record<string, number>;
  topics: TopicShare[];
  topics_by_year: Record<string, TopicShare[]>;
  institutions: InstitutionCount[];
}

export interface Conference {
  id: string;
  title: string;
  acronym: string;
  rank: string;
  for_codes: string[];
  categories: string[];
  dblp_url?: string | null;
  avg_rating?: string | null;
  rank_history: RankHistoryEntry[];
  stats: YearStat[] | null;
  stats_source: "papercopilot" | "lixin4ever" | "papercopilot+lixin4ever" | null;
  openalex?: OpenAlexData;
}

export const RANK_ORDER: Record<string, number> = {
  "A*": 1,
  A: 2,
  B: 3,
  "Australasian B": 4,
  C: 5,
  "Australasian C": 6,
};

export const ALL_CATEGORIES = [
  "Artificial Intelligence",
  "Machine Learning",
  "Computer Vision & Multimedia",
  "Cybersecurity & Privacy",
  "Data Management & Mining",
  "Distributed Systems & Networks",
  "Software Engineering & PL",
  "Human-Computer Interaction",
  "Theory of Computation",
  "Graphics, VR & Games",
  "Hardware & Architecture",
  "Information Systems",
  "Applied Computing",
  "General & Interdisciplinary CS",
] as const;

export function rankOrder(rank: string): number {
  return RANK_ORDER[rank] ?? 90;
}
