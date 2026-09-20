"use client";

import { useState } from "react";
import RankBadge from "./RankBadge";
import { DualRankBadge } from "./DualRankBadge";

const CORE_TIERS = [
  {
    rank: "A*",
    label: "Flagship",
    share: "7.5% of ranked",
    description: "Leading international venue; premier standard of excellence in the field.",
  },
  {
    rank: "A",
    label: "Premier",
    share: "13.1% of ranked",
    description: "Highly selective and prestigious international venue with high impact.",
  },
  {
    rank: "B",
    label: "Established",
    share: "30.2% of ranked",
    description: "Solid, well-regarded international venue with rigorous peer review.",
  },
  {
    rank: "C",
    label: "Recognized",
    share: "46.2% of ranked",
    description: "Quality venue meeting international peer-review standards.",
  },
  {
    rank: "Australasian B",
    label: "Australasian Tier",
    share: "Regional priority",
    description: "Venues of distinct significance to the Australasian research community.",
  },
  {
    rank: "National: USA",
    label: "National / Regional",
    share: "Specialized",
    description: "Venues serving national communities or specific country societies.",
  },
  {
    rank: "Unranked",
    label: "Unranked",
    share: "Tracked",
    description: "Tracked venues currently undergoing evaluation, merged, or unranked.",
  },
];

const SJR_TIERS = [
  {
    quartile: "Q1",
    label: "Top 25%",
    share: "Top Quartile",
    description: "Highest impact journals ranked in the top 25% of their subject category by SCImago Journal Rank (SJR).",
  },
  {
    quartile: "Q2",
    label: "25% - 50%",
    share: "Second Quartile",
    description: "High-impact journals in the 50th to 75th percentile of their subject category.",
  },
  {
    quartile: "Q3",
    label: "50% - 75%",
    share: "Third Quartile",
    description: "Recognized journals in the 25th to 50th percentile of their subject category.",
  },
  {
    quartile: "Q4",
    label: "Bottom 25%",
    share: "Fourth Quartile",
    description: "Journals in the lowest 25% percentile distribution of their subject category.",
  },
];

export default function RankLegend() {
  const [open, setOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<"core" | "sjr">("core");

  return (
    <div className="mb-6 rounded-xl border border-border bg-surface p-4 shadow-xs">
      <div className="flex items-center justify-between">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-bold uppercase tracking-wider text-muted">
            Rank Guide & Color Legend:
          </span>
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="inline-flex items-center gap-1 text-xs">
              <DualRankBadge coreRank="A*" size="sm" />
              <span className="text-stone-700 dark:text-stone-300 font-medium">Flagship</span>
            </span>
            <span className="text-stone-300 dark:text-stone-700">·</span>
            <span className="inline-flex items-center gap-1 text-xs">
              <DualRankBadge coreRank="A" size="sm" />
              <span className="text-stone-700 dark:text-stone-300 font-medium">Premier</span>
            </span>
            <span className="text-stone-300 dark:text-stone-700">·</span>
            <span className="inline-flex items-center gap-1 text-xs">
              <DualRankBadge sjrQuartile="Q1" size="sm" />
              <span className="text-stone-700 dark:text-stone-300 font-medium">SJR Top 25%</span>
            </span>
            <span className="text-stone-300 dark:text-stone-700">·</span>
            <span className="inline-flex items-center gap-1 text-xs">
              <DualRankBadge sjrQuartile="Q2" size="sm" />
              <span className="text-stone-700 dark:text-stone-300 font-medium">SJR 25-50%</span>
            </span>
          </div>
        </div>
        <button
          type="button"
          onClick={() => setOpen(!open)}
          className="ml-2 text-xs font-semibold text-accent hover:underline cursor-pointer"
        >
          {open ? "Hide details ▲" : "View all tiers ▼"}
        </button>
      </div>

      {open && (
        <div className="mt-4 border-t border-border pt-4">
          <div className="mb-3 flex items-center gap-2">
            <button
              type="button"
              onClick={() => setActiveTab("core")}
              className={`rounded-md px-3 py-1 text-xs font-medium cursor-pointer transition-colors ${
                activeTab === "core"
                  ? "bg-accent text-white"
                  : "bg-stone-100 text-stone-600 hover:bg-stone-200 dark:bg-stone-800 dark:text-stone-300 dark:hover:bg-stone-700"
              }`}
            >
              CORE Ranking (Conferences & Journals)
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("sjr")}
              className={`rounded-md px-3 py-1 text-xs font-medium cursor-pointer transition-colors ${
                activeTab === "sjr"
                  ? "bg-accent text-white"
                  : "bg-stone-100 text-stone-600 hover:bg-stone-200 dark:bg-stone-800 dark:text-stone-300 dark:hover:bg-stone-700"
              }`}
            >
              SCImago / SJR Quartiles (Journals)
            </button>
          </div>

          {activeTab === "core" ? (
            <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
              {CORE_TIERS.map((tier) => (
                <div
                  key={tier.rank}
                  className="rounded-lg border border-border bg-stone-50/50 p-3 dark:bg-stone-900/40"
                >
                  <div className="flex items-center gap-2">
                    <RankBadge rank={tier.rank} size="md" />
                    <span className="font-bold text-stone-900 text-xs dark:text-stone-100">
                      {tier.label}
                    </span>
                    <span className="ml-auto text-[10px] font-semibold text-muted">
                      {tier.share}
                    </span>
                  </div>
                  <p className="mt-1.5 text-xs text-muted leading-relaxed">
                    {tier.description}
                  </p>
                </div>
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-4">
              {SJR_TIERS.map((tier) => (
                <div
                  key={tier.quartile}
                  className="rounded-lg border border-border bg-stone-50/50 p-3 dark:bg-stone-900/40"
                >
                  <div className="flex items-center gap-2">
                    <DualRankBadge sjrQuartile={tier.quartile} size="md" />
                    <span className="font-bold text-stone-900 text-xs dark:text-stone-100">
                      {tier.label}
                    </span>
                    <span className="ml-auto text-[10px] font-semibold text-muted">
                      {tier.share}
                    </span>
                  </div>
                  <p className="mt-1.5 text-xs text-muted leading-relaxed">
                    {tier.description}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
