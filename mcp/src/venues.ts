/**
 * Venue assembly: merges conferences + journal index into a uniform shape
 * for search/compare/suggest, and implements the six MCP tools' logic.
 */
import {
  getConferences,
  getDeadlines,
  getJournalIndex,
  getJournal,
  stampCache,
  type Conference,
  type DeadlineEntry,
  type Journal,
  type JournalIndexEntry,
} from "./data.js";
import { suggestVenues, type AmbitionTier, type SuggesterVenue } from "./suggest.js";
import type { VenueType } from "./similarity.js";

export const ALL_CATEGORIES = [
  "Artificial Intelligence", "Machine Learning", "Computer Vision & Multimedia",
  "Cybersecurity & Privacy", "Data Management & Mining", "Distributed Systems & Networks",
  "Software Engineering & PL", "Human-Computer Interaction", "Theory of Computation",
  "Graphics, VR & Games", "Hardware & Architecture", "Information Systems",
  "Applied Computing", "General & Interdisciplinary CS",
  "Mathematics", "Physics & Astronomy", "Chemistry", "Materials Science",
  "Biochemistry, Genetics & Molecular Biology", "Neuroscience",
  "Earth & Planetary Sciences", "Interdisciplinary Science & Computing",
];

const VALID_RANKS = new Set(["A*", "A", "B", "C", "Australasian B", "Australasian C", "National", "Unranked", "Q1", "Q2", "Q3", "Q4"]);

function latestRate(c: Conference): number | null {
  if (!c.stats || !c.stats.length) return null;
  const sorted = [...c.stats].filter((s) => s.rate != null).sort((a, b) => b.year - a.year);
  return sorted[0]?.rate ?? null;
}
function latestAccepted(c: Conference): number | null {
  if (!c.stats || !c.stats.length) return null;
  const sorted = [...c.stats].filter((s) => s.accepted != null).sort((a, b) => b.year - a.year);
  return sorted[0]?.accepted ?? null;
}

function confSummary(c: Conference) {
  return {
    id: c.id, type: "conference" as const, acronym: c.acronym, title: c.title,
    rank: c.rank, categories: c.categories,
    latest_acceptance_rate: latestRate(c),
    latest_accepted: latestAccepted(c),
    has_stats: Boolean(c.stats?.length),
    upcoming_deadlines: (c.deadlines ?? []).map((d) => ({
      year: d.year, cycle: d.cycle ?? null,
      paper_deadline: d.paper_deadline,
      abstract_deadline: d.abstract_deadline ?? null,
      timezone: d.timezone, cfp_url: d.cfp_url ?? null,
    })),
    dblp_url: (c as { dblp_url?: string | null }).dblp_url ?? null,
  };
}

function journalSummary(j: JournalIndexEntry | Journal) {
  const full = "sjr" in j ? (j as Journal) : null;
  return {
    id: j.id, type: "journal" as const,
    acronym: j.acronym, title: j.title,
    core_rank: j.core_rank,
    sjr_quartile: "sjr_quartile" in j ? j.sjr_quartile : full?.sjr?.latest_quartile ?? null,
    sjr_score: "sjr_score" in j ? j.sjr_score : full?.sjr?.latest_score ?? null,
    h_index: "h_index" in j ? j.h_index : full?.sjr?.latest_h_index ?? null,
    is_oa: j.is_oa, categories: j.categories, publisher: j.publisher, issn: j.issn,
  };
}

// ---------------------------------------------------------------- search
export interface SearchArgs {
  query: string;
  type?: "all" | VenueType;
  ranks?: string[];
  categories?: string[];
  limit?: number;
}

export async function searchVenues(a: SearchArgs) {
  const q = a.query.toLowerCase().trim();
  const ranks = (a.ranks ?? []).filter((r) => VALID_RANKS.has(r));
  const cats = a.categories ?? [];
  const limit = Math.min(Math.max(a.limit ?? 20, 1), 100);
  const wantConfs = !a.type || a.type === "all" || a.type === "conference";
  const wantJrnls = !a.type || a.type === "all" || a.type === "journal";

  const out: unknown[] = [];
  if (wantConfs) {
    for (const c of await getConferences()) {
      if (ranks.length && !ranks.includes(c.rank)) continue;
      if (cats.length && !c.categories.some((x) => cats.includes(x))) continue;
      if (q && !c.title.toLowerCase().includes(q) && !c.acronym.toLowerCase().includes(q)) continue;
      out.push(confSummary(c));
      if (out.length >= limit) return { count: out.length, results: out };
    }
  }
  if (wantJrnls) {
    for (const j of await getJournalIndex()) {
      if (out.length >= limit) break;
      const rankOk =
        !ranks.length ||
        (j.core_rank && ranks.includes(j.core_rank)) ||
        (j.sjr_quartile && ranks.includes(j.sjr_quartile));
      if (!rankOk) continue;
      if (cats.length && !j.categories.some((x) => cats.includes(x))) continue;
      const qMatch =
        !q ||
        j.title.toLowerCase().includes(q) ||
        (j.acronym?.toLowerCase().includes(q) ?? false) ||
        (j.publisher?.toLowerCase().includes(q) ?? false) ||
        (j.issn ?? []).some((i) => i.toLowerCase().includes(q));
      if (!qMatch) continue;
      out.push(journalSummary(j));
    }
  }
  return { count: out.length, results: out.slice(0, limit) };
}

// ---------------------------------------------------------------- get
export async function getVenue(id: string) {
  const confs = await getConferences();
  const conf = confs.find((c) => c.id === id);
  if (conf) {
    return { found: true, venue: { ...confSummary(conf), rank_history: conf.rank_history, stats: conf.stats, openalex: conf.openalex ?? null } };
  }
  const journal = await getJournal(id);
  if (journal) {
    return { found: true, venue: { ...journalSummary(journal), core_rank_history: journal.core_rank_history, sjr_history: journal.sjr?.history ?? null, country: journal.country, openalex: journal.openalex ?? null } };
  }
  return { found: false, error: `No venue with id "${id}". Use search_venues to find ids.` };
}

// ---------------------------------------------------------------- compare
export async function compareVenues(ids: string[]) {
  const venues = await Promise.all(ids.map((id) => getVenue(id)));
  return {
    compared: ids.length,
    venues: venues.map((v, i) => (v.found ? v.venue : { id: ids[i], error: "not found" })),
  };
}

// ---------------------------------------------------------------- suggest
function toSuggesterVenues(confs: Conference[], jrnls: JournalIndexEntry[]): SuggesterVenue[] {
  const fromConfs: SuggesterVenue[] = confs.map((c) => ({
    id: c.id, type: "conference", acronym: c.acronym, title: c.title,
    rank: c.rank, categories: c.categories,
    latest_rate: latestRate(c), latest_accepted: latestAccepted(c),
    has_stats: Boolean(c.stats?.length),
    topics: c.openalex?.topics?.map((t) => t.name) ?? [],
  }));
  const fromJrnls: SuggesterVenue[] = jrnls.map((j) => ({
    id: j.id, type: "journal", acronym: j.acronym ?? "", title: j.title,
    rank: j.core_rank ?? j.sjr_quartile ?? "Unranked",
    core_rank: j.core_rank, sjr_quartile: j.sjr_quartile,
    categories: j.categories,
    latest_rate: null, latest_accepted: null, has_stats: false,
  }));
  return [...fromConfs, ...fromJrnls];
}

export interface SuggestArgs {
  abstract: string;
  type?: "all" | VenueType;
  ambition?: AmbitionTier;
  topN?: number;
}

export async function suggestForAbstract(a: SuggestArgs) {
  const [confs, jrnls] = await Promise.all([getConferences(), getJournalIndex()]);
  const venues = toSuggesterVenues(confs, jrnls);
  const result = suggestVenues(a.abstract, venues, {
    ambition: a.ambition ?? "all",
    venueType: a.type ?? "all",
    topN: Math.min(Math.max(a.topN ?? 12, 1), 30),
  });
  return {
    ...result,
    suggestions: result.suggestions.map((s) => ({
      ...s,
      venue: {
        id: s.venue.id, type: s.venue.type, acronym: s.venue.acronym,
        title: s.venue.title, rank: s.venue.rank,
        sjr_quartile: s.venue.sjr_quartile ?? null,
        categories: s.venue.categories,
        latest_acceptance_rate: s.venue.latest_rate,
      },
    })),
  };
}

// ---------------------------------------------------------------- deadlines
export interface DeadlineArgs {
  windowDays?: number;
  ranks?: string[];
  categories?: string[];
  deadlineType?: "paper" | "abstract";
}

function parseDdl(s: string | null | undefined): number {
  if (!s) return NaN;
  const m = s.trim().match(/^(\d{4})-(\d{2})-(\d{2})(?:[ T](\d{2}):(\d{2})(?::(\d{2}))?)?/);
  if (!m) return NaN;
  const [, y, mo, d, h = "23", mi = "59", sec = "59"] = m;
  // AoE = UTC-12: a deadline "23:59 AoE" is 11:59 UTC the NEXT day. Add 12h.
  return Date.UTC(+y, +mo - 1, +d, +h, +mi, +sec) + 12 * 3600 * 1000;
}

export async function upcomingDeadlines(a: DeadlineArgs) {
  const windowDays = Math.min(Math.max(a.windowDays ?? 60, 1), 730);
  const ranks = (a.ranks ?? []).filter((r) => VALID_RANKS.has(r));
  const cats = a.categories ?? [];
  const now = Date.now();
  const horizon = now + windowDays * 86400_000;

  const items = (await getDeadlines())
    .map((d: DeadlineEntry) => {
      const effStr = a.deadlineType === "abstract" ? d.abstract_deadline : d.paper_deadline;
      if (!effStr) return null;
      const ts = parseDdl(effStr);
      if (isNaN(ts) || ts < now || ts > horizon) return null;
      if (ranks.length && !ranks.includes(d.rank)) return null;
      if (cats.length && !d.categories.some((c) => cats.includes(c))) return null;
      return {
        venue_id: d.venue_id, acronym: d.acronym, title: d.title, rank: d.rank,
        categories: d.categories, cycle: d.cycle ?? null, year: d.year,
        deadline_type: a.deadlineType ?? "paper",
        deadline: effStr, timezone: d.timezone,
        days_left: Math.floor((ts - now) / 86400_000),
        paper_deadline: d.paper_deadline,
        abstract_deadline: d.abstract_deadline ?? null,
        cfp_url: d.cfp_url ?? null, location: d.location ?? null,
        conference_dates: d.conference_dates ?? null,
      };
    })
    .filter((x): x is NonNullable<typeof x> => x !== null)
    .sort((x, y) => x.days_left - y.days_left);

  return { window_days: windowDays, deadline_type: a.deadlineType ?? "paper", count: items.length, deadlines: items };
}

// ---------------------------------------------------------------- stats
export async function acceptanceStats(id: string) {
  const confs = await getConferences();
  const conf = confs.find((c) => c.id === id);
  if (!conf) return { found: false, error: `No conference with id "${id}" (acceptance stats exist for conferences only).` };
  const sorted = [...(conf.stats ?? [])].sort((a, b) => a.year - b.year);
  return {
    found: true, id: conf.id, acronym: conf.acronym, title: conf.title,
    rank: conf.rank, stats_source: conf.stats_source,
    years: sorted.length, stats: sorted,
  };
}

/** Best-effort cache timestamp refresh after tool use. */
export async function refreshStamp() { await stampCache(); }
