"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import RankBadge from "./RankBadge";
import {
  suggestVenues,
  type SuggesterVenue,
  type AmbitionTier,
  type Suggestion,
} from "@/lib/suggest";
import { getVenueEmbeddingIndex } from "@/lib/embedding-index";
import {
  embedAbstract,
  initEmbedder,
  getEmbedderState,
  subscribeEmbedderState,
  type EmbedderState,
} from "@/lib/embedder";

const SAMPLE_ABSTRACTS = [
  {
    title: "Deep Learning / NLP",
    text: "We present a parameter-efficient fine-tuning method for large language models based on low-rank matrix decomposition and selective attention pruning. Through extensive empirical evaluation on benchmark question answering and machine translation datasets, our approach achieves competitive accuracy while reducing training memory overhead by 45%. We also investigate scaling laws and gradient descent dynamics.",
  },
  {
    title: "Cybersecurity & Systems",
    text: "This paper analyzes side-channel vulnerabilities in zero-trust containerized edge deployments. We design an automated fuzzing and threat modeling pipeline to identify cryptographic leakage and privilege escalation vectors. Evaluation on realistic cloud testbeds demonstrates three novel exploits and provides verified hardware and software countermeasures against malicious tenants.",
  },
  {
    title: "HCI & User Study",
    text: "We investigate how conversational AI agents influence collaborative decision-making in remote workplace environments. Through a within-subjects user study (N=48) and qualitative post-task interviews, we evaluate participant cognitive load, perceived trust, and interaction friction across three distinct interface paradigms. Results highlight trade-offs in autonomous recommendation framing.",
  },
];

export default function SuggestClient({ venues }: { venues: SuggesterVenue[] }) {
  const [abstract, setAbstract] = useState("");
  const [ambition, setAmbition] = useState<AmbitionTier>("all");
  const [includeUnranked, setIncludeUnranked] = useState(false);

  // Neural embedding states
  const [embedderState, setEmbedderState] = useState<EmbedderState>(getEmbedderState());
  const [embeddingScores, setEmbeddingScores] = useState<Map<string, number> | null>(null);
  const [isEmbeddingCalculating, setIsEmbeddingCalculating] = useState(false);
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Subscribe to embedder status updates
  useEffect(() => {
    return subscribeEmbedderState(setEmbedderState);
  }, []);

  // Preload embedder and venue embeddings index on mount
  useEffect(() => {
    initEmbedder().catch(() => {});
    getVenueEmbeddingIndex().catch(() => {});
  }, []);

  // Debounced semantic embedding calculation
  useEffect(() => {
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    const trimmed = abstract.trim();
    const wordCount = trimmed ? trimmed.split(/\s+/).length : 0;

    debounceTimerRef.current = setTimeout(async () => {
      if (wordCount < 30) {
        setEmbeddingScores(null);
        setIsEmbeddingCalculating(false);
        return;
      }

      setIsEmbeddingCalculating(true);
      try {
        const [index, queryVec] = await Promise.all([
          getVenueEmbeddingIndex(),
          embedAbstract(trimmed),
        ]);

        if (index && queryVec) {
          const scores = index.computeSimilarity(queryVec);
          setEmbeddingScores(scores);
        }
      } catch (err) {
        console.warn("Failed to compute semantic embeddings:", err);
      } finally {
        setIsEmbeddingCalculating(false);
      }
    }, 350);

    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, [abstract]);

  const result = useMemo(() => {
    return suggestVenues(abstract, venues, {
      ambition,
      topN: 18,
      includeUnranked,
      embeddingScores: embeddingScores ?? undefined,
    });
  }, [abstract, venues, ambition, includeUnranked, embeddingScores]);

  // Group suggestions into tiers
  const tieredSuggestions = useMemo(() => {
    const stretch: Suggestion[] = [];
    const target: Suggestion[] = [];
    const safe: Suggestion[] = [];

    for (const s of result.suggestions) {
      if (s.tier === "stretch") stretch.push(s);
      else if (s.tier === "target") target.push(s);
      else safe.push(s);
    }

    return { stretch, target, safe };
  }, [result.suggestions]);

  const loadSample = (text: string) => {
    setAbstract(text);
  };

  return (
    <div className="space-y-8">
      {/* Input Section */}
      <div className="rounded-2xl border border-stone-200 bg-surface p-6 shadow-xs dark:border-stone-800">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-lg font-bold text-foreground">
              Paste Paper Abstract
            </h2>
            <p className="text-xs text-muted">
              We analyze vocabulary, research categories, and 384-dim semantic embeddings to suggest relevant CS conferences.
            </p>
          </div>
          {abstract && (
            <button
              onClick={() => {
                setAbstract("");
                setEmbeddingScores(null);
              }}
              className="self-start text-xs font-semibold text-muted hover:text-foreground cursor-pointer"
            >
              Clear input
            </button>
          )}
        </div>

        <div className="mt-4">
          <textarea
            value={abstract}
            onChange={(e) => setAbstract(e.target.value)}
            rows={6}
            placeholder="Paste your title and abstract here… (e.g. 'We propose an adaptive distributed consensus algorithm that minimizes latency in mobile ad-hoc networks…')"
            className="w-full rounded-xl border border-stone-300 bg-stone-50 p-4 text-sm text-foreground placeholder:text-muted focus:border-accent focus:bg-surface focus:outline-none focus:ring-1 focus:ring-accent dark:border-stone-700 dark:bg-stone-900/50 dark:focus:border-accent dark:focus:bg-stone-900"
          />
        </div>

        {/* Quick sample buttons, word count & AI status */}
        <div className="mt-3 flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex flex-wrap items-center gap-1.5 text-stone-600 dark:text-stone-400">
            <span className="font-semibold">Try sample:</span>
            {SAMPLE_ABSTRACTS.map((sample) => (
              <button
                key={sample.title}
                type="button"
                onClick={() => loadSample(sample.text)}
                className="rounded-md border border-stone-200 bg-surface px-2 py-1 font-medium text-stone-700 hover:bg-stone-100 dark:border-stone-700 dark:text-stone-300 dark:hover:bg-stone-800 transition cursor-pointer"
              >
                {sample.title}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-3 text-muted">
            {isEmbeddingCalculating && (
              <span className="inline-flex items-center gap-1 text-[11px] font-medium text-accent animate-pulse">
                <span>🧠 Calculating neural embedding…</span>
              </span>
            )}
            {result.wordCount > 0 && (
              <span>
                {result.wordCount} words{" "}
                {result.isTooShort && (
                  <span className="text-amber-700 dark:text-amber-400">
                    (need ~35+ for accurate match)
                  </span>
                )}
              </span>
            )}
          </div>
        </div>

        {/* Model download progress bar if loading */}
        {embedderState.status === "loading" && embedderState.progress > 0 && (
          <div className="mt-4 rounded-xl border border-indigo-100 bg-indigo-50/70 p-3 dark:border-indigo-950 dark:bg-indigo-950/30">
            <div className="flex items-center justify-between text-xs font-semibold text-indigo-900 dark:text-indigo-200">
              <span className="flex items-center gap-1.5">
                <span className="animate-spin text-indigo-600">⚡</span>
                {embedderState.statusText}
              </span>
              <span>{embedderState.progress}%</span>
            </div>
            <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-indigo-200/60 dark:bg-indigo-900">
              <div
                className="h-full rounded-full bg-indigo-600 transition-all duration-300"
                style={{ width: `${embedderState.progress}%` }}
              />
            </div>
          </div>
        )}

        {/* Filters and Ambition */}
        <div className="mt-5 border-t border-stone-200 pt-5 dark:border-stone-800">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs font-bold text-stone-700 dark:text-stone-300">
                Target Ambition:
              </span>
              {(
                [
                  { id: "all", label: "All Tiers", desc: "Balanced ranking" },
                  { id: "stretch", label: "🚀 Stretch", desc: "A* & highly selective" },
                  { id: "target", label: "🎯 Target", desc: "Solid CORE A / B matches" },
                  { id: "safe", label: "🛡️ Safer Bet", desc: "Accessible B / C tiers" },
                ] as const
              ).map((tier) => (
                <button
                  key={tier.id}
                  onClick={() => setAmbition(tier.id)}
                  title={tier.desc}
                  className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition cursor-pointer ${
                    ambition === tier.id
                      ? "bg-accent text-accent-contrast"
                      : "border border-stone-200 bg-surface text-stone-600 hover:bg-stone-100 dark:border-stone-700 dark:text-stone-300 dark:hover:bg-stone-800"
                  }`}
                >
                  {tier.label}
                </button>
              ))}
            </div>

            <label className="flex items-center gap-2 text-xs font-medium text-muted cursor-pointer select-none">
              <input
                type="checkbox"
                checked={includeUnranked}
                onChange={(e) => setIncludeUnranked(e.target.checked)}
                className="rounded border-stone-300 text-accent focus:ring-accent"
              />
              <span>Include Unranked Venues</span>
            </label>
          </div>
        </div>
      </div>

      {/* Abstract Analysis Signals */}
      {result.detectedCategories.length > 0 && (
        <div className="rounded-xl border border-stone-200 bg-surface p-5 dark:border-stone-800 shadow-xs">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <h3 className="text-xs font-bold uppercase tracking-wider text-muted">
                Detected Research Focus
              </h3>
              {result.isSemanticReady && (
                <span className="inline-flex items-center gap-1 rounded-full bg-indigo-50 px-2 py-0.5 text-[10px] font-bold text-indigo-700 dark:bg-indigo-950/80 dark:text-indigo-300">
                  <span>🧠 Neural AI Active</span>
                </span>
              )}
            </div>
            <span
              className={`rounded-full px-2.5 py-0.5 text-[11px] font-bold ${
                result.confidence === "high"
                  ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300"
                  : result.confidence === "medium"
                    ? "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300"
                    : "bg-stone-100 text-stone-600 dark:bg-stone-800 dark:text-stone-300"
              }`}
              title="Confidence reflects neural semantic similarity and abstract length"
            >
              {result.confidence} confidence
            </span>
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            {result.detectedCategories.map((c) => (
              <span
                key={c.category}
                className="inline-flex items-center gap-1.5 rounded-full bg-accent-soft px-3 py-1 text-xs font-semibold text-accent"
              >
                <span>{c.category}</span>
                <span className="text-[10px] font-normal opacity-75">
                  ({c.matchedTerms.length} keywords)
                </span>
              </span>
            ))}
            {result.detectedMethodologies.map((m) => (
              <span
                key={m.label}
                className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1 text-xs font-medium text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300"
              >
                <span>🔬 {m.label}</span>
              </span>
            ))}
          </div>

          {result.detectedKeywords.length > 0 && (
            <div className="mt-3 text-xs text-muted">
              <span className="font-semibold">Key terms found:</span>{" "}
              {result.detectedKeywords.join(", ")}
            </div>
          )}
        </div>
      )}

      {/* Results Section */}
      {result.isTooShort ? (
        <div className="rounded-xl border border-dashed border-stone-300 p-12 text-center dark:border-stone-700">
          <div className="mx-auto grid size-12 place-items-center rounded-full bg-accent-soft text-accent text-xl font-bold">
            💡
          </div>
          <h3 className="mt-4 text-base font-bold text-foreground">
            Ready to find your venue
          </h3>
          <p className="mx-auto mt-1 max-w-md text-xs text-muted">
            Paste your draft abstract above or click one of the quick samples to see tailored venue recommendations across CORE prestige tiers.
          </p>
        </div>
      ) : result.suggestions.length === 0 ? (
        <div className="rounded-xl border border-stone-200 bg-surface p-8 text-center dark:border-stone-800">
          <p className="text-sm font-semibold text-stone-700 dark:text-stone-300">
            No matching conferences found for the detected topics.
          </p>
          <p className="mt-1 text-xs text-muted">
            Try expanding your abstract text or enabling &quot;Include Unranked Venues&quot;.
          </p>
        </div>
      ) : (
        <div className="space-y-8">
          {/* Section: Stretch Venues */}
          {(ambition === "all" || ambition === "stretch") &&
            tieredSuggestions.stretch.length > 0 && (
              <div>
                <div className="mb-3 flex items-center gap-2">
                  <span className="text-sm font-bold text-foreground">
                    🚀 Stretch Venues (A* & Highly Selective)
                  </span>
                  <span className="text-xs text-muted">
                    ({tieredSuggestions.stretch.length})
                  </span>
                </div>
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {tieredSuggestions.stretch.map((s) => (
                    <VenueCard key={s.venue.id} suggestion={s} />
                  ))}
                </div>
              </div>
            )}

          {/* Section: Target Venues */}
          {(ambition === "all" || ambition === "target") &&
            tieredSuggestions.target.length > 0 && (
              <div>
                <div className="mb-3 flex items-center gap-2">
                  <span className="text-sm font-bold text-foreground">
                    🎯 Target Venues (Solid CORE A & Strong B Matches)
                  </span>
                  <span className="text-xs text-muted">
                    ({tieredSuggestions.target.length})
                  </span>
                </div>
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {tieredSuggestions.target.map((s) => (
                    <VenueCard key={s.venue.id} suggestion={s} />
                  ))}
                </div>
              </div>
            )}

          {/* Section: Safe / Accessible Venues */}
          {(ambition === "all" || ambition === "safe") &&
            tieredSuggestions.safe.length > 0 && (
              <div>
                <div className="mb-3 flex items-center gap-2">
                  <span className="text-sm font-bold text-foreground">
                    🛡️ Accessible / Backup Venues (B, C & Higher Acceptance)
                  </span>
                  <span className="text-xs text-muted">
                    ({tieredSuggestions.safe.length})
                  </span>
                </div>
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {tieredSuggestions.safe.map((s) => (
                    <VenueCard key={s.venue.id} suggestion={s} />
                  ))}
                </div>
              </div>
            )}
        </div>
      )}

      {/* Methodology & CFP Disclaimer */}
      <div className="rounded-xl border border-stone-200 bg-stone-50 p-4 text-xs text-stone-600 dark:border-stone-800 dark:bg-stone-900/50 dark:text-stone-400">
        <p className="font-semibold text-stone-800 dark:text-stone-200">
          How this matching works:
        </p>
        <p className="mt-1">
          Suggestions combine 384-dimensional neural semantic embeddings (running locally in your browser via WebAssembly with zero server tracking), multi-word keyword extraction across 14 computer science sub-fields, TF-IDF document similarity over venue titles/categories/topics, and CORE prestige rankings. Acceptance rates are shown for context when available. Always consult the conference&apos;s formal Call for Papers (CFP) to confirm specific track requirements and page limits before submitting.
        </p>
      </div>
    </div>
  );
}

function VenueCard({ suggestion }: { suggestion: Suggestion }) {
  const { venue, matchPercentage, reasons, semanticScore } = suggestion;

  return (
    <div className="flex flex-col justify-between rounded-xl border border-stone-200 bg-surface p-4 shadow-xs transition hover:border-stone-300 hover:shadow-md dark:border-stone-800 dark:hover:border-stone-700">
      <div>
        <div className="flex items-start justify-between gap-2">
          <Link
            href={`/conference/${venue.id}/`}
            className="group flex flex-col"
          >
            <span className="text-base font-black text-foreground group-hover:text-accent transition">
              {venue.acronym || venue.title.slice(0, 16)}
            </span>
            <span className="line-clamp-2 text-xs text-muted">
              {venue.title}
            </span>
          </Link>
          <RankBadge rank={venue.rank} size="sm" />
        </div>

        {/* Fit Score & Progress Bar */}
        <div className="mt-3">
          <div className="flex items-center justify-between text-xs">
            <span className="font-semibold text-stone-700 dark:text-stone-300 flex items-center gap-1.5">
              <span>Fit Score</span>
              {semanticScore !== undefined && semanticScore >= 0.35 && (
                <span
                  title={`Neural semantic similarity: ${(semanticScore * 100).toFixed(0)}%`}
                  className="rounded bg-indigo-100 px-1 py-0.2 text-[9px] font-bold text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300"
                >
                  Neural Match
                </span>
              )}
            </span>
            <span
              className={`font-black ${
                matchPercentage >= 75
                  ? "text-emerald-700 dark:text-emerald-400"
                  : matchPercentage >= 50
                    ? "text-accent"
                    : "text-muted"
              }`}
            >
              {matchPercentage}%
            </span>
          </div>
          <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-stone-100 dark:bg-stone-800">
            <div
              className={`h-full rounded-full transition-all duration-500 ${
                matchPercentage >= 75
                  ? "bg-emerald-600"
                  : matchPercentage >= 50
                    ? "bg-accent"
                    : "bg-stone-400"
              }`}
              style={{ width: `${matchPercentage}%` }}
            />
          </div>
        </div>

        {/* Categories chips */}
        <div className="mt-3 flex flex-wrap gap-1">
          {venue.categories.slice(0, 2).map((cat) => (
            <span
              key={cat}
              className="rounded bg-stone-100 px-1.5 py-0.5 text-[10px] font-medium text-stone-700 dark:bg-stone-800 dark:text-stone-300"
            >
              {cat}
            </span>
          ))}
        </div>

        {/* Reasons */}
        <ul className="mt-3 space-y-1 text-[11px] text-muted">
          {reasons.slice(0, 2).map((r, i) => (
            <li key={i} className="flex items-center gap-1.5">
              <span className="text-accent">•</span>
              <span className="truncate">{r}</span>
            </li>
          ))}
        </ul>
      </div>

      <div className="mt-4 flex items-center justify-between border-t border-stone-200 pt-3 dark:border-stone-800 text-xs">
        {venue.latest_rate !== null ? (
          <span className="text-muted">
            Acceptance:{" "}
            <strong className="text-stone-800 dark:text-stone-200">
              {venue.latest_rate}%
            </strong>
          </span>
        ) : (
          <span className="text-muted">
            No acceptance data
          </span>
        )}

        <Link
          href={`/conference/${venue.id}/`}
          className="font-bold text-accent hover:underline"
        >
          View stats →
        </Link>
      </div>
    </div>
  );
}
