import type { Journal } from "./journal-types";

export interface DirectoryJournal {
  id: string;
  title: string;
  acronym: string | null;
  issn: string[];
  publisher: string | null;
  core_rank: "A*" | "A" | "B" | "C" | "Unranked" | null;
  sjr: {
    latest_score: number | null;
    latest_quartile?: "Q1" | "Q2" | "Q3" | "Q4" | null;
    latest_h_index: number | null;
  } | null;
  categories: string[];
  is_oa: boolean;
}

export function toDirectoryJournal(j: Journal): DirectoryJournal {
  return {
    id: j.id,
    title: j.title,
    acronym: j.acronym,
    issn: j.issn,
    publisher: j.publisher,
    core_rank: j.core_rank,
    sjr: j.sjr
      ? {
          latest_score: j.sjr.latest_score,
          latest_quartile: j.sjr.latest_quartile,
          latest_h_index: j.sjr.latest_h_index,
        }
      : null,
    categories: j.categories,
    is_oa: j.is_oa,
  };
}
