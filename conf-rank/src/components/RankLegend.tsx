"use client";

import { useState } from "react";
import RankBadge from "./RankBadge";

const TIERS = [
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
    description: "Highly selective and prestigious international conference with high impact.",
  },
  {
    rank: "B",
    label: "Established",
    share: "30.2% of ranked",
    description: "Solid, well-regarded international conference with rigorous peer review.",
  },
  {
    rank: "C",
    label: "Recognized",
    share: "46.2% of ranked",
    description: "Quality conference meeting international peer-review standards.",
  },
  {
    rank: "Australasian B",
    label: "Australasian Tier",
    share: "Regional priority",
    description: "Conferences of distinct significance to the Australasian research community.",
  },
  {
    rank: "National: USA",
    label: "National / Regional",
    share: "Specialized",
    description: "Conferences serving national communities or specific country societies.",
  },
  {
    rank: "Unranked",
    label: "Unranked",
    share: "Tracked",
    description: "Tracked conferences currently undergoing evaluation, merged, or unranked.",
  },
];

export default function RankLegend() {
  const [open, setOpen] = useState(false);

  return (
    <div className="mb-6 rounded-xl border border-neutral-200 bg-white p-4 shadow-xs
                    dark:border-neutral-800 dark:bg-neutral-900">
      <div className="flex items-center justify-between">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-bold uppercase tracking-wider text-neutral-500 dark:text-neutral-400">
            Rank Guide & Color Legend:
          </span>
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="inline-flex items-center gap-1 text-xs">
              <RankBadge rank="A*" size="sm" />
              <span className="text-neutral-600 dark:text-neutral-300 font-medium">Flagship (top 7.5%)</span>
            </span>
            <span className="text-neutral-300 dark:text-neutral-700">·</span>
            <span className="inline-flex items-center gap-1 text-xs">
              <RankBadge rank="A" size="sm" />
              <span className="text-neutral-600 dark:text-neutral-300 font-medium">Premier (top 13%)</span>
            </span>
            <span className="text-neutral-300 dark:text-neutral-700">·</span>
            <span className="inline-flex items-center gap-1 text-xs">
              <RankBadge rank="B" size="sm" />
              <span className="text-neutral-600 dark:text-neutral-300 font-medium">Established</span>
            </span>
            <span className="text-neutral-300 dark:text-neutral-700">·</span>
            <span className="inline-flex items-center gap-1 text-xs">
              <RankBadge rank="C" size="sm" />
              <span className="text-neutral-600 dark:text-neutral-300 font-medium">Recognized</span>
            </span>
          </div>
        </div>
        <button
          type="button"
          onClick={() => setOpen(!open)}
          className="ml-2 text-xs font-semibold text-blue-600 hover:underline dark:text-blue-400"
        >
          {open ? "Hide details ▲" : "View all tiers ▼"}
        </button>
      </div>

      {open && (
        <div className="mt-4 grid grid-cols-1 gap-2.5 border-t border-neutral-100 pt-4 sm:grid-cols-2 lg:grid-cols-3
                        dark:border-neutral-800">
          {TIERS.map((tier) => (
            <div
              key={tier.rank}
              className="rounded-lg border border-neutral-100 bg-neutral-50/70 p-3
                         dark:border-neutral-800 dark:bg-neutral-950/50"
            >
              <div className="flex items-center gap-2">
                <RankBadge rank={tier.rank} size="md" />
                <span className="font-bold text-neutral-900 text-xs dark:text-neutral-100">
                  {tier.label}
                </span>
                <span className="ml-auto text-[10px] font-semibold text-neutral-500 dark:text-neutral-400">
                  {tier.share}
                </span>
              </div>
              <p className="mt-1.5 text-xs text-neutral-600 dark:text-neutral-400 leading-relaxed">
                {tier.description}
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
