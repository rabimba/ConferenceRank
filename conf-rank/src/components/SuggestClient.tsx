"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import RankBadge from "./RankBadge";
import {
  suggestVenues,
  type SuggesterVenue,
  type AmbitionTier,
  type Suggestion,
} from "@/lib/suggest";

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

  const result = useMemo(() => {
    return suggestVenues(abstract, venues, {
      ambition,
      topN: 18,
      includeUnranked,
    });
  }, [abstract, venues, ambition, includeUnranked]);

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
      <div className="rounded-2xl border border-neutral-200 bg-white p-6 shadow-xs dark:border-neutral-800 dark:bg-neutral-900">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-lg font-bold text-neutral-900 dark:text-neutral-100">
              Paste Paper Abstract
            </h2>
            <p className="text-xs text-neutral-500 dark:text-neutral-400">
              We analyze vocabulary, research categories, and methodology to suggest relevant CS conferences.
            </p>
          </div>
          {abstract && (
            <button
              onClick={() => setAbstract("")}
              className="self-start text-xs font-semibold text-neutral-500 hover:text-neutral-800 dark:text-neutral-400 dark:hover:text-neutral-200"
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
            className="w-full rounded-xl border border-neutral-300 bg-neutral-50 p-4 text-sm text-neutral-900 placeholder:text-neutral-400 focus:border-blue-600 focus:bg-white focus:outline-none focus:ring-1 focus:ring-blue-600 dark:border-neutral-700 dark:bg-neutral-950 dark:text-neutral-100 dark:placeholder:text-neutral-500 dark:focus:border-blue-400 dark:focus:bg-neutral-900 dark:focus:ring-blue-400"
          />
        </div>

        {/* Quick sample buttons & word count */}
        <div className="mt-3 flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex flex-wrap items-center gap-1.5 text-neutral-600 dark:text-neutral-400">
            <span className="font-semibold">Try sample:</span>
            {SAMPLE_ABSTRACTS.map((sample) => (
              <button
                key={sample.title}
                type="button"
                onClick={() => loadSample(sample.text)}
                className="rounded-md border border-neutral-200 bg-white px-2 py-1 font-medium text-neutral-700 hover:bg-neutral-100 dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-300 dark:hover:bg-neutral-700 transition"
              >
                {sample.title}
              </button>
            ))}
          </div>

          <div className="text-neutral-500 dark:text-neutral-400">
            {result.wordCount > 0 && (
              <span>
                {result.wordCount} words{" "}
                {result.isTooShort && (
                  <span className="text-amber-600 dark:text-amber-400">
                    (need ~35+ for accurate match)
                  </span>
                )}
              </span>
            )}
          </div>
        </div>

        {/* Filters and Ambition */}
        <div className="mt-5 border-t border-neutral-100 pt-5 dark:border-neutral-800">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs font-bold text-neutral-700 dark:text-neutral-300">
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
                  className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                    ambition === tier.id
                      ? "bg-neutral-900 text-white dark:bg-neutral-100 dark:text-neutral-900"
                      : "border border-neutral-200 bg-white text-neutral-600 hover:bg-neutral-100 dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-300 dark:hover:bg-neutral-700"
                  }`}
                >
                  {tier.label}
                </button>
              ))}
            </div>

            <label className="flex items-center gap-2 text-xs font-medium text-neutral-600 dark:text-neutral-400 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={includeUnranked}
                onChange={(e) => setIncludeUnranked(e.target.checked)}
                className="rounded border-neutral-300 text-blue-600 focus:ring-blue-500"
              />
              <span>Include Unranked Venues</span>
            </label>
          </div>
        </div>
      </div>

      {/* Abstract Analysis Signals */}
      {result.detectedCategories.length > 0 && (
        <div className="rounded-xl border border-neutral-200 bg-white p-5 dark:border-neutral-800 dark:bg-neutral-900 shadow-xs">
          <div className="flex items-center justify-between gap-3">
            <h3 className="text-xs font-bold uppercase tracking-wider text-neutral-500 dark:text-neutral-400">
              Detected Research Focus
            </h3>
            <span
              className={`rounded-full px-2.5 py-0.5 text-[11px] font-bold ${
                result.confidence === "high"
                  ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300"
                  : result.confidence === "medium"
                    ? "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300"
                    : "bg-neutral-100 text-neutral-600 dark:bg-neutral-800 dark:text-neutral-300"
              }`}
              title="Confidence reflects keyword signal strength and abstract length"
            >
              {result.confidence} confidence
            </span>
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            {result.detectedCategories.map((c) => (
              <span
                key={c.category}
                className="inline-flex items-center gap-1.5 rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-700 dark:bg-blue-950/70 dark:text-blue-300"
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
                className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1 text-xs font-medium text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300"
              >
                <span>🔬 {m.label}</span>
              </span>
            ))}
          </div>

          {result.detectedKeywords.length > 0 && (
            <div className="mt-3 text-xs text-neutral-500 dark:text-neutral-400">
              <span className="font-semibold">Key terms found:</span>{" "}
              {result.detectedKeywords.join(", ")}
            </div>
          )}
        </div>
      )}

      {/* Results Section */}
      {result.isTooShort ? (
        <div className="rounded-xl border border-dashed border-neutral-300 p-12 text-center dark:border-neutral-700">
          <div className="mx-auto grid size-12 place-items-center rounded-full bg-blue-50 text-blue-600 dark:bg-blue-950 dark:text-blue-400 text-xl font-bold">
            💡
          </div>
          <h3 className="mt-4 text-base font-bold text-neutral-900 dark:text-neutral-100">
            Ready to find your venue
          </h3>
          <p className="mx-auto mt-1 max-w-md text-xs text-neutral-500 dark:text-neutral-400">
            Paste your draft abstract above or click one of the quick samples to see tailored venue recommendations across CORE prestige tiers.
          </p>
        </div>
      ) : result.suggestions.length === 0 ? (
        <div className="rounded-xl border border-neutral-200 bg-white p-8 text-center dark:border-neutral-800 dark:bg-neutral-900">
          <p className="text-sm font-semibold text-neutral-700 dark:text-neutral-300">
            No matching conferences found for the detected topics.
          </p>
          <p className="mt-1 text-xs text-neutral-500 dark:text-neutral-400">
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
                  <span className="text-sm font-bold text-neutral-900 dark:text-neutral-100">
                    🚀 Stretch Venues (A* & Highly Selective)
                  </span>
                  <span className="text-xs text-neutral-500 dark:text-neutral-400">
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
                  <span className="text-sm font-bold text-neutral-900 dark:text-neutral-100">
                    🎯 Target Venues (Solid CORE A & Strong B Matches)
                  </span>
                  <span className="text-xs text-neutral-500 dark:text-neutral-400">
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
                  <span className="text-sm font-bold text-neutral-900 dark:text-neutral-100">
                    🛡️ Accessible / Backup Venues (B, C & Higher Acceptance)
                  </span>
                  <span className="text-xs text-neutral-500 dark:text-neutral-400">
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
      <div className="rounded-xl border border-neutral-200 bg-neutral-50 p-4 text-xs text-neutral-600 dark:border-neutral-800 dark:bg-neutral-900/50 dark:text-neutral-400">
        <p className="font-semibold text-neutral-800 dark:text-neutral-200">
          How this matching works:
        </p>
        <p className="mt-1">
          Suggestions combine multi-word keyword extraction against 14 computer science sub-fields, TF-IDF document similarity over venue titles/categories/OpenAlex topics, and CORE prestige rankings. Acceptance rates are shown for context when available. Always consult the conference&apos;s formal Call for Papers (CFP) to confirm specific track requirements and page limits before submitting.
        </p>
      </div>
    </div>
  );
}

function VenueCard({ suggestion }: { suggestion: Suggestion }) {
  const { venue, matchPercentage, reasons } = suggestion;

  return (
    <div className="flex flex-col justify-between rounded-xl border border-neutral-200 bg-white p-4 shadow-xs transition hover:border-neutral-300 hover:shadow-md dark:border-neutral-800 dark:bg-neutral-900 dark:hover:border-neutral-700">
      <div>
        <div className="flex items-start justify-between gap-2">
          <Link
            href={`/conference/${venue.id}/`}
            className="group flex flex-col"
          >
            <span className="text-base font-black text-neutral-900 group-hover:text-blue-600 dark:text-neutral-100 dark:group-hover:text-blue-400 transition">
              {venue.acronym || venue.title.slice(0, 16)}
            </span>
            <span className="line-clamp-2 text-xs text-neutral-500 dark:text-neutral-400">
              {venue.title}
            </span>
          </Link>
          <RankBadge rank={venue.rank} size="sm" />
        </div>

        {/* Fit Score & Progress Bar */}
        <div className="mt-3">
          <div className="flex items-center justify-between text-xs">
            <span className="font-semibold text-neutral-700 dark:text-neutral-300">
              Fit Score
            </span>
            <span
              className={`font-black ${
                matchPercentage >= 75
                  ? "text-emerald-600 dark:text-emerald-400"
                  : matchPercentage >= 50
                    ? "text-blue-600 dark:text-blue-400"
                    : "text-neutral-600 dark:text-neutral-400"
              }`}
            >
              {matchPercentage}%
            </span>
          </div>
          <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-neutral-100 dark:bg-neutral-800">
            <div
              className={`h-full rounded-full transition-all duration-500 ${
                matchPercentage >= 75
                  ? "bg-emerald-500"
                  : matchPercentage >= 50
                    ? "bg-blue-500"
                    : "bg-neutral-400"
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
              className="rounded bg-neutral-100 px-1.5 py-0.5 text-[10px] font-medium text-neutral-600 dark:bg-neutral-800 dark:text-neutral-300"
            >
              {cat}
            </span>
          ))}
        </div>

        {/* Reasons */}
        <ul className="mt-3 space-y-1 text-[11px] text-neutral-500 dark:text-neutral-400">
          {reasons.slice(0, 2).map((r, i) => (
            <li key={i} className="flex items-center gap-1.5">
              <span className="text-blue-500 dark:text-blue-400">•</span>
              <span className="truncate">{r}</span>
            </li>
          ))}
        </ul>
      </div>

      <div className="mt-4 flex items-center justify-between border-t border-neutral-100 pt-3 dark:border-neutral-800 text-xs">
        {venue.latest_rate !== null ? (
          <span className="text-neutral-500 dark:text-neutral-400">
            Acceptance:{" "}
            <strong className="text-neutral-800 dark:text-neutral-200">
              {venue.latest_rate}%
            </strong>
          </span>
        ) : (
          <span className="text-neutral-400 dark:text-neutral-500">
            No acceptance data
          </span>
        )}

        <Link
          href={`/conference/${venue.id}/`}
          className="font-bold text-blue-600 hover:underline dark:text-blue-400"
        >
          View stats →
        </Link>
      </div>
    </div>
  );
}
