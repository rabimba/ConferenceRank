"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import type { LandscapePoint } from "@/app/page";

const RANK_COLORS: Record<string, { bg: string; text: string; bar: string; border: string }> = {
  "A*": {
    bg: "bg-amber-50 dark:bg-amber-950/40",
    text: "text-amber-800 dark:text-amber-300",
    bar: "bg-amber-500",
    border: "border-amber-200 dark:border-amber-800",
  },
  A: {
    bg: "bg-indigo-50 dark:bg-indigo-950/40",
    text: "text-indigo-800 dark:text-indigo-300",
    bar: "bg-indigo-600 dark:bg-indigo-400",
    border: "border-indigo-200 dark:border-indigo-800",
  },
  B: {
    bg: "bg-teal-50 dark:bg-teal-950/40",
    text: "text-teal-800 dark:text-teal-300",
    bar: "bg-teal-600 dark:bg-teal-400",
    border: "border-teal-200 dark:border-teal-800",
  },
  C: {
    bg: "bg-stone-100 dark:bg-stone-800",
    text: "text-stone-700 dark:text-stone-300",
    bar: "bg-stone-400",
    border: "border-stone-300 dark:border-stone-700",
  },
};

type ViewMode = "field" | "tier" | "top";

export default function AcceptanceLandscape({
  points,
  totalAStar,
}: {
  points: LandscapePoint[];
  totalAStar?: number;
}) {
  const [viewMode, setViewMode] = useState<ViewMode>("tier");
  const [selectedRank, setSelectedRank] = useState<string>("ALL");
  const [selectedCategory, setSelectedCategory] = useState<string>("ALL");

  // Summary Metrics across all venues with acceptance rates
  const statsSummary = useMemo(() => {
    if (!points.length) return null;
    const rates = points.map((p) => p.rate).sort((a, b) => a - b);
    const median = rates[Math.floor(rates.length / 2)];
    const avg = Math.round((rates.reduce((sum, r) => sum + r, 0) / rates.length) * 10) / 10;
    const mostSelective = [...points].sort((a, b) => a.rate - b.rate)[0];
    return {
      total: points.length,
      median,
      avg,
      min: rates[0],
      max: rates[rates.length - 1],
      mostSelective,
    };
  }, [points]);

  // Breakdown by CORE Rank
  const rankTiers = useMemo(() => {
    const ranks = ["A*", "A", "B", "C"];
    return ranks.map((rank) => {
      const inTier = points.filter((p) => p.rank === rank);
      const rates = inTier.map((p) => p.rate).sort((a, b) => a - b);
      const median = rates.length ? rates[Math.floor(rates.length / 2)] : null;
      const avg = rates.length
        ? Math.round((rates.reduce((s, r) => s + r, 0) / rates.length) * 10) / 10
        : null;
      return {
        rank,
        count: inTier.length,
        min: rates.length ? rates[0] : null,
        max: rates.length ? rates[rates.length - 1] : null,
        median,
        avg,
        venues: inTier.sort((a, b) => a.rate - b.rate),
      };
    });
  }, [points]);

  // Breakdown by Category / Research Field
  const categoryTiers = useMemo(() => {
    const catMap = new Map<string, LandscapePoint[]>();
    for (const p of points) {
      for (const cat of p.categories) {
        if (!catMap.has(cat)) catMap.set(cat, []);
        catMap.get(cat)!.push(p);
      }
    }
    return Array.from(catMap.entries())
      .map(([category, items]) => {
        const rates = items.map((p) => p.rate).sort((a, b) => a - b);
        const median = rates[Math.floor(rates.length / 2)];
        const avg = Math.round((rates.reduce((s, r) => s + r, 0) / rates.length) * 10) / 10;
        return {
          category,
          count: items.length,
          median,
          avg,
          min: rates[0],
          max: rates[rates.length - 1],
          venues: items.sort((a, b) => a.rate - b.rate),
        };
      })
      .sort((a, b) => b.count - a.count);
  }, [points]);

  // A* coverage, derived from data
  const aStarInData = useMemo(
    () => points.filter((p) => p.rank === "A*").length,
    [points],
  );

  // Top Most Selective Venues
  const sortedVenues = useMemo(() => {
    let filtered = points;
    if (selectedRank !== "ALL") {
      filtered = filtered.filter((p) => p.rank === selectedRank);
    }
    if (selectedCategory !== "ALL") {
      filtered = filtered.filter((p) => p.categories.includes(selectedCategory));
    }
    return [...filtered].sort((a, b) => a.rate - b.rate);
  }, [points, selectedRank, selectedCategory]);

  return (
    <div className="space-y-6">
      {/* KPI Stats Ribbon */}
      {statsSummary && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="rounded-xl border border-stone-200 bg-stone-50/50 p-3 dark:border-stone-800 dark:bg-stone-900/50">
            <div className="text-[11px] font-semibold uppercase tracking-wider text-muted">
              Coverage
            </div>
            <div className="mt-1 text-xl font-black text-foreground">
              {statsSummary.total} <span className="text-xs font-normal text-muted">venues</span>
            </div>
            <div className="mt-0.5 text-[11px] text-muted">
              {totalAStar
                ? `${aStarInData} of ${totalAStar} A* venues (${Math.round((aStarInData / totalAStar) * 100)}%)`
                : `${aStarInData} A* venues`}
            </div>
          </div>

          <div className="rounded-xl border border-stone-200 bg-stone-50/50 p-3 dark:border-stone-800 dark:bg-stone-900/50">
            <div className="text-[11px] font-semibold uppercase tracking-wider text-muted">
              Median Selectivity
            </div>
            <div className="mt-1 text-xl font-black text-accent">
              {statsSummary.median}%
            </div>
            <div className="mt-0.5 text-[11px] text-muted">
              Mean: {statsSummary.avg}%
            </div>
          </div>

          <div className="rounded-xl border border-stone-200 bg-stone-50/50 p-3 dark:border-stone-800 dark:bg-stone-900/50">
            <div className="text-[11px] font-semibold uppercase tracking-wider text-muted">
              Most Selective
            </div>
            <div className="mt-1 text-xl font-black text-emerald-700 dark:text-emerald-400">
              {statsSummary.min}%
            </div>
            <div className="mt-0.5 text-[11px] text-muted truncate">
              {statsSummary.mostSelective?.acronym} ({statsSummary.mostSelective?.year})
            </div>
          </div>

          <div className="rounded-xl border border-stone-200 bg-stone-50/50 p-3 dark:border-stone-800 dark:bg-stone-900/50">
            <div className="text-[11px] font-semibold uppercase tracking-wider text-muted">
              Selective Range
            </div>
            <div className="mt-1 text-xl font-black text-foreground">
              {statsSummary.min}% – {statsSummary.max}%
            </div>
            <div className="mt-0.5 text-[11px] text-muted">
              across CS disciplines
            </div>
          </div>
        </div>
      )}

      {/* Sub-view Selector Tabs */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-stone-200 pb-3 dark:border-stone-800">
        <div className="inline-flex rounded-lg bg-stone-100 p-1 dark:bg-stone-800 text-xs font-semibold">
          <button
            onClick={() => setViewMode("tier")}
            className={`rounded-md px-3 py-1.5 transition ${
              viewMode === "tier"
                ? "bg-surface text-foreground shadow-xs"
                : "text-muted hover:text-foreground"
            }`}
          >
            Prestige Tier Comparison (A* → C)
          </button>
          <button
            onClick={() => setViewMode("field")}
            className={`rounded-md px-3 py-1.5 transition ${
              viewMode === "field"
                ? "bg-surface text-foreground shadow-xs"
                : "text-muted hover:text-foreground"
            }`}
          >
            By Research Field
          </button>
          <button
            onClick={() => setViewMode("top")}
            className={`rounded-md px-3 py-1.5 transition ${
              viewMode === "top"
                ? "bg-surface text-foreground shadow-xs"
                : "text-muted hover:text-foreground"
            }`}
          >
            All Venues List & Filter
          </button>
        </div>

        <span className="text-xs text-muted">
          Showing latest reported cycle rate per venue
        </span>
      </div>

      {/* VIEW 1: PRESTIGE TIER COMPARISON (A* -> C) */}
      {viewMode === "tier" && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {rankTiers.map((tier) => {
              const theme = RANK_COLORS[tier.rank] ?? RANK_COLORS["C"];
              return (
                <div
                  key={tier.rank}
                  className={`rounded-xl border p-4 ${theme.bg} ${theme.border}`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className={`px-2 py-0.5 rounded text-sm font-black ${theme.text} bg-surface shadow-xs`}>
                        {tier.rank}
                      </span>
                      <span className="text-xs font-semibold text-stone-600 dark:text-stone-400">
                        {tier.count} venues with stats
                      </span>
                    </div>
                    {tier.median != null && (
                      <div className="text-right">
                        <span className="text-xs text-muted">Median: </span>
                        <span className="text-sm font-bold text-foreground">
                          {tier.median}%
                        </span>
                      </div>
                    )}
                  </div>

                  {tier.min != null && tier.max != null && (
                    <div className="mt-3">
                      <div className="flex justify-between text-[11px] text-muted mb-1">
                        <span>Most selective: {tier.min}%</span>
                        <span>Avg: {tier.avg}%</span>
                        <span>Highest: {tier.max}%</span>
                      </div>
                      {/* Visual Range Bar */}
                      <div className="relative h-2.5 w-full rounded-full bg-stone-200 dark:bg-stone-800 overflow-hidden">
                        <div
                          className={`absolute h-full rounded-full ${theme.bar}`}
                          style={{
                            left: `${Math.max(0, (tier.min / 60) * 100)}%`,
                            width: `${Math.max(4, ((tier.max - tier.min) / 60) * 100)}%`,
                          }}
                        />
                      </div>
                    </div>
                  )}

                  {/* Representative Venues Chips */}
                  <div className="mt-3 flex flex-wrap gap-1.5 pt-2 border-t border-black/5 dark:border-white/5">
                    {tier.venues.slice(0, 10).map((v) => (
                      <Link
                        key={v.id}
                        href={`/conference/${v.id}`}
                        className="inline-flex items-center gap-1 rounded bg-surface/90 px-2 py-1 text-xs font-medium text-stone-800 shadow-2xs hover:bg-surface hover:underline dark:text-stone-200"
                        title={`${v.title} — ${v.rate}% (${v.year})`}
                      >
                        <span className="font-semibold">{v.acronym}</span>
                        <span className="text-[10px] text-muted">{v.rate}%</span>
                      </Link>
                    ))}
                    {tier.venues.length > 10 && (
                      <span className="inline-flex items-center px-1 text-[11px] text-muted">
                        +{tier.venues.length - 10} more
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* VIEW 2: BY RESEARCH FIELD */}
      {viewMode === "field" && (
        <div className="space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {categoryTiers.map((cat) => (
              <div
                key={cat.category}
                className="rounded-xl border border-stone-200 bg-surface p-4 dark:border-stone-800 shadow-xs"
              >
                <div className="flex items-center justify-between mb-2">
                  <h3 className="font-bold text-sm text-foreground truncate pr-2">
                    {cat.category}
                  </h3>
                  <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-stone-100 dark:bg-stone-800 text-stone-600 dark:text-stone-400 whitespace-nowrap">
                    {cat.count} venue{cat.count === 1 ? "" : "s"}
                  </span>
                </div>

                <div className="flex items-center justify-between text-xs text-muted mb-1.5">
                  <span>Median rate: <strong className="text-foreground">{cat.median}%</strong></span>
                  <span>Range: {cat.min}% – {cat.max}%</span>
                </div>

                <div className="relative h-2 w-full rounded-full bg-stone-100 dark:bg-stone-800 overflow-hidden mb-3">
                  <div
                    className="absolute h-full rounded-full bg-accent"
                    style={{
                      left: `${Math.max(0, (cat.min / 60) * 100)}%`,
                      width: `${Math.max(4, ((cat.max - cat.min) / 60) * 100)}%`,
                    }}
                  />
                </div>

                <div className="flex flex-wrap gap-1.5">
                  {cat.venues.slice(0, 8).map((v) => (
                    <Link
                      key={v.id}
                      href={`/conference/${v.id}`}
                      className="inline-flex items-center gap-1 rounded border border-stone-200 bg-stone-50 px-2 py-0.5 text-xs text-stone-700 hover:bg-stone-100 hover:underline dark:border-stone-800 dark:bg-stone-800/60 dark:text-stone-300 dark:hover:bg-stone-800"
                    >
                      <span className="font-semibold">{v.acronym}</span>
                      <span className="text-[10px] text-muted">{v.rate}%</span>
                    </Link>
                  ))}
                  {cat.venues.length > 8 && (
                    <span className="text-[11px] text-stone-400 self-center">
                      +{cat.venues.length - 8} more
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* VIEW 3: SEARCHABLE VENUES TABLE / LIST */}
      {viewMode === "top" && (
        <div className="space-y-3">
          {/* Filters */}
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-1.5 text-xs">
              <span className="text-muted font-medium">Rank:</span>
              {["ALL", "A*", "A", "B", "C"].map((r) => (
                <button
                  key={r}
                  onClick={() => setSelectedRank(r)}
                  className={`px-2 py-1 rounded text-xs font-semibold transition ${
                    selectedRank === r
                      ? "bg-accent text-accent-contrast"
                      : "bg-stone-100 text-stone-600 hover:bg-stone-200 dark:bg-stone-800 dark:text-stone-400"
                  }`}
                >
                  {r}
                </button>
              ))}
            </div>

            <div className="flex items-center gap-1.5 text-xs ml-auto">
              <span className="text-muted font-medium">Field:</span>
              <select
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
                className="rounded border border-stone-300 bg-surface px-2 py-1 text-xs text-foreground dark:border-stone-700"
              >
                <option value="ALL">All Disciplines</option>
                {categoryTiers.map((c) => (
                  <option key={c.category} value={c.category}>
                    {c.category} ({c.count})
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Sorted Ranked Venues Grid */}
          <div
            tabIndex={0}
            aria-label="Scrollable list of venues by acceptance rate"
            className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5 max-h-[420px] overflow-y-auto p-1"
          >
            {sortedVenues.map((v) => {
              const theme = RANK_COLORS[v.rank] ?? RANK_COLORS["C"];
              return (
                <Link
                  key={v.id}
                  href={`/conference/${v.id}`}
                  className="group flex items-center justify-between rounded-lg border border-stone-200 bg-surface p-2.5 hover:border-accent hover:shadow-xs dark:border-stone-800 transition"
                >
                  <div className="min-w-0 pr-2">
                    <div className="flex items-center gap-1.5">
                      <span className="font-bold text-xs text-foreground group-hover:text-accent">
                        {v.acronym}
                      </span>
                      <span className={`text-[10px] px-1 py-0.2 rounded font-bold ${theme.bg} ${theme.text}`}>
                        {v.rank}
                      </span>
                    </div>
                    <div className="text-[11px] text-muted truncate max-w-[190px]">
                      {v.title}
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <div className="text-sm font-black text-accent">
                      {v.rate}%
                    </div>
                    <div className="text-[10px] text-muted">
                      {v.year ?? "latest"}
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
