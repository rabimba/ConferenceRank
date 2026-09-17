import {
  CATEGORY_LEXICON,
  METHODOLOGY_SIGNALS,
  ENGLISH_STOPWORDS,
} from "./lexicon";
import { buildTfidfIndex, similarity, type TfidfIndex } from "./similarity";

let tfidfCache: { venuesKey: string; index: TfidfIndex } | null = null;

function getTfidfIndex(venues: SuggesterVenue[]): TfidfIndex {
  const key = `${venues.length}:${venues[0]?.id ?? ""}:${venues[venues.length - 1]?.id ?? ""}`;
  if (tfidfCache && tfidfCache.venuesKey === key) return tfidfCache.index;
  const index = buildTfidfIndex(
    venues.map((v) => ({
      id: v.id,
      text: [v.title, v.acronym, ...v.categories, ...(v.topics ?? [])].join(" "),
    })),
  );
  tfidfCache = { venuesKey: key, index };
  return index;
}

export interface SuggesterVenue {
  id: string;
  acronym: string;
  title: string;
  rank: string;
  categories: string[];
  latest_rate: number | null;
  latest_accepted: number | null;
  has_stats: boolean;
  /** OpenAlex top topics when available — enrich similarity matching */
  topics?: string[];
}

export type AmbitionTier = "all" | "stretch" | "target" | "safe";

export interface Suggestion {
  venue: SuggesterVenue;
  totalScore: number;
  matchPercentage: number;
  tier: "stretch" | "target" | "safe";
  matchedCategories: string[];
  matchedKeywords: string[];
  titleKeywordMatches: string[];
  reasons: string[];
}

export interface CategoryScore {
  category: string;
  score: number;
  matchedTerms: string[];
}

export interface SuggestOptions {
  ambition?: AmbitionTier;
  topN?: number;
  minCategoryScore?: number;
  includeUnranked?: boolean;
}

export interface SuggestResult {
  suggestions: Suggestion[];
  detectedCategories: CategoryScore[];
  detectedMethodologies: { label: string; keywords: string[] }[];
  detectedKeywords: string[];
  wordCount: number;
  isTooShort: boolean;
  confidence: "high" | "medium" | "low";
}

const RANK_BASE_WEIGHTS: Record<string, number> = {
  "A*": 1.0,
  A: 0.85,
  B: 0.65,
  "Australasian B": 0.60,
  C: 0.45,
  "Australasian C": 0.40,
  National: 0.30,
  Unranked: 0.20,
};

function cleanText(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\w\s-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function tokenize(cleanStr: string): string[] {
  return cleanStr
    .split(/\s+/)
    .map((w) => w.replace(/^[-_]+|[-_]+$/g, ""))
    .filter((w) => w.length > 2 && !ENGLISH_STOPWORDS.has(w));
}

function extractKeywordsAndCategories(cleanStr: string): {
  categoryScores: CategoryScore[];
  matchedKeywords: string[];
  detectedMethodologies: { label: string; keywords: string[] }[];
} {
  const words = cleanStr.split(" ");
  const wordSet = new Set(words);
  const foundKeywords = new Set<string>();
  const scores: CategoryScore[] = [];

  for (const [category, lexicon] of Object.entries(CATEGORY_LEXICON)) {
    const matchedTerms: string[] = [];
    let catScore = 0;

    for (const term of lexicon) {
      if (term.includes(" ")) {
        // Multi-word phrase check
        if (cleanStr.includes(term)) {
          matchedTerms.push(term);
          foundKeywords.add(term);
          catScore += 3.5; // Multi-word phrases carry strong semantic signal
        }
      } else {
        // Unigram check with word boundary
        if (wordSet.has(term)) {
          matchedTerms.push(term);
          foundKeywords.add(term);
          catScore += 1.5;
        }
      }
    }

    if (catScore > 0) {
      scores.push({
        category,
        score: Math.round(catScore * 10) / 10,
        matchedTerms,
      });
    }
  }

  // Sort categories descending
  scores.sort((a, b) => b.score - a.score);

  // Detect methodology signals
  const detectedMethodologies: { label: string; keywords: string[] }[] = [];
  for (const sig of METHODOLOGY_SIGNALS) {
    const matched: string[] = [];
    for (const kw of sig.keywords) {
      if (kw.includes(" ") ? cleanStr.includes(kw) : wordSet.has(kw)) {
        matched.push(kw);
      }
    }
    if (matched.length > 0) {
      detectedMethodologies.push({
        label: sig.label,
        keywords: matched,
      });
    }
  }

  return {
    categoryScores: scores,
    matchedKeywords: Array.from(foundKeywords),
    detectedMethodologies,
  };
}

function determineTier(venue: SuggesterVenue): "stretch" | "target" | "safe" {
  if (venue.rank === "A*") return "stretch";
  if (venue.latest_rate !== null && venue.latest_rate <= 20) return "stretch";
  if (venue.rank === "A") return "target";
  if (venue.latest_rate !== null && venue.latest_rate <= 30) return "target";
  return "safe";
}

function computeAmbitionAdjustment(
  rank: string,
  latestRate: number | null,
  ambition: AmbitionTier
): number {
  if (ambition === "all") {
    return (RANK_BASE_WEIGHTS[rank] ?? 0.3) * 0.15;
  }

  const isHighlySelective =
    rank === "A*" || (latestRate !== null && latestRate <= 20);
  const isModerate =
    rank === "A" ||
    rank === "B" ||
    (latestRate !== null && latestRate > 20 && latestRate <= 32);
  const isAccessible =
    rank === "C" ||
    rank === "Australasian B" ||
    rank === "Australasian C" ||
    (latestRate !== null && latestRate > 32);

  if (ambition === "stretch") {
    if (isHighlySelective) return 0.25;
    if (isModerate) return 0.10;
    return -0.05;
  }

  if (ambition === "target") {
    if (isModerate) return 0.22;
    if (isHighlySelective) return 0.12;
    return 0.08;
  }

  if (ambition === "safe") {
    if (isAccessible) return 0.25;
    if (isModerate) return 0.15;
    return -0.05;
  }

  return 0;
}

export function suggestVenues(
  abstract: string,
  venues: SuggesterVenue[],
  options: SuggestOptions = {}
): SuggestResult {
  const ambition = options.ambition ?? "all";
  const topN = options.topN ?? 12;
  const includeUnranked = options.includeUnranked ?? false;

  const clean = cleanText(abstract);
  const tokens = tokenize(clean);
  const wordCount = clean ? clean.split(/\s+/).length : 0;
  const isTooShort = wordCount < 35;

  if (isTooShort || !clean) {
    return {
      suggestions: [],
      detectedCategories: [],
      detectedMethodologies: [],
      detectedKeywords: [],
      wordCount,
      isTooShort: true,
      confidence: "low",
    };
  }

  const { categoryScores, matchedKeywords, detectedMethodologies } =
    extractKeywordsAndCategories(clean);

  // Confidence assessment
  let confidence: "high" | "medium" | "low" = "low";
  if (categoryScores.length > 0) {
    const topScore = categoryScores[0].score;
    if (topScore >= 8 && wordCount >= 70) confidence = "high";
    else if (topScore >= 3.5) confidence = "medium";
  }

  const tokenSet = new Set(tokens);
  const topCategoryMap = new Map<string, number>();
  const maxScore = categoryScores[0]?.score || 1;
  const tfidf = getTfidfIndex(venues);

  for (const cs of categoryScores.slice(0, 4)) {
    // Normalized category weight between 0.2 and 1.0
    topCategoryMap.set(cs.category, cs.score / maxScore);
  }

  const scoredVenues: Suggestion[] = [];

  for (const venue of venues) {
    if (!includeUnranked && (venue.rank === "Unranked" || !venue.rank)) {
      continue;
    }

    // 1. Category affinity score (0..1)
    let categoryAffinity = 0;
    const matchedCategories: string[] = [];

    for (const cat of venue.categories) {
      if (topCategoryMap.has(cat)) {
        const weight = topCategoryMap.get(cat)!;
        categoryAffinity = Math.max(categoryAffinity, weight);
        matchedCategories.push(cat);
      }
    }

    // If no category match, skip this venue unless it has direct title overlap
    const venueTitleTokens = tokenize(cleanText(venue.title));
    const venueAcronymLower = venue.acronym.toLowerCase();

    // 2. Title & acronym keyword overlap
    const titleMatches: string[] = [];
    for (const vt of venueTitleTokens) {
      if (tokenSet.has(vt) && !ENGLISH_STOPWORDS.has(vt)) {
        titleMatches.push(vt);
      }
    }

    const hasAcronymMention =
      venueAcronymLower.length >= 3 && tokenSet.has(venueAcronymLower);
    const titleOverlapScore =
      Math.min(titleMatches.length * 0.15 + (hasAcronymMention ? 0.35 : 0), 0.6);

    // 2b. TF-IDF cosine similarity against venue doc (title+categories+topics).
    // Captures stems/bigrams beyond the curated lexicon; capped at 0.6 so a
    // strongly related venue with no exact keyword hit can still surface.
    const simScore = Math.min(similarity(tfidf, venue.id, abstract) * 2.2, 0.6);

    if (categoryAffinity === 0 && titleOverlapScore === 0 && simScore < 0.15) {
      continue;
    }

    // 3. Ambition & rank weighting
    const ambitionAdjustment = computeAmbitionAdjustment(
      venue.rank,
      venue.latest_rate,
      ambition
    );

    // 4. Combined score formula:
    // Category match 40% · title overlap 15% · doc similarity 25% · ambition 20%
    const rawScore =
      categoryAffinity * 0.4 +
      titleOverlapScore * 0.15 +
      simScore * 0.25 +
      ambitionAdjustment;

    // Normalize to 0-100%
    const boundedScore = Math.max(0.1, Math.min(rawScore, 1.0));
    const matchPercentage = Math.round(boundedScore * 100);

    // Reasons breakdown
    const reasons: string[] = [];
    if (matchedCategories.length > 0) {
      const topCat = matchedCategories[0];
      const catData = categoryScores.find((c) => c.category === topCat);
      const termCount = catData ? catData.matchedTerms.length : 0;
      reasons.push(
        `${topCat} fit${termCount > 0 ? ` (${termCount} keyword${termCount > 1 ? "s" : ""})` : ""}`
      );
    }
    if (simScore >= 0.25) {
      reasons.push("Strong text similarity to venue scope/topics");
    }
    if (titleMatches.length > 0) {
      reasons.push(
        `Title matches: ${titleMatches.slice(0, 3).join(", ")}`
      );
    }
    if (venue.latest_rate !== null) {
      reasons.push(`${venue.latest_rate}% acceptance rate`);
    }

    const tier = determineTier(venue);

    scoredVenues.push({
      venue,
      totalScore: rawScore,
      matchPercentage,
      tier,
      matchedCategories,
      matchedKeywords: matchedKeywords.slice(0, 8),
      titleKeywordMatches: titleMatches,
      reasons,
    });
  }

  // Sort by score descending
  scoredVenues.sort((a, b) => b.totalScore - a.totalScore);

  return {
    suggestions: scoredVenues.slice(0, topN),
    detectedCategories: categoryScores.slice(0, 4),
    detectedMethodologies,
    detectedKeywords: matchedKeywords.slice(0, 12),
    wordCount,
    isTooShort: false,
    confidence,
  };
}
