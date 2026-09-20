export interface SJRHistoryPoint {
  year: number;
  sjr: number | null;
  quartile?: "Q1" | "Q2" | "Q3" | "Q4";
  h_index: number | null;
}

export interface SJRData {
  latest_score: number | null;
  latest_quartile?: "Q1" | "Q2" | "Q3" | "Q4" | null;
  latest_h_index: number | null;
  history: SJRHistoryPoint[];
}

export type SJRRecord = SJRData;

export interface JournalRankHistory {
  source: string;
  year?: number;
  rank: string;
  for_code?: string;
}

export interface Journal {
  id: string;
  title: string;
  acronym: string | null;
  issn: string[];
  publisher: string | null;
  country: string | null;
  core_rank: "A*" | "A" | "B" | "C" | "Unranked" | null;
  core_rank_history: JournalRankHistory[];
  sjr: SJRData | null;
  categories: string[];
  dblp_url: string | null;
  is_oa: boolean;
  openalex?: {
    source_ids: string[];
    works_per_year: Record<string, number>;
    two_year_mean_citedness?: number;
    topics: Array<{ name: string; share: number }>;
    topics_by_year?: Record<string, Array<{ name: string; share: number }>>;
    top_institutions: Array<{ name: string; country: string; share: number }>;
  };
}
