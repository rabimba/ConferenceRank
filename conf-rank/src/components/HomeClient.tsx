/* eslint-disable react-hooks/set-state-in-effect */
"use client";

import { useState, useMemo, useEffect, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Directory, { type DirectoryEntry } from "./Directory";
import DeadlinesView from "./DeadlinesView";
import CompareModal from "./CompareModal";
import AcceptanceLandscape from "./AcceptanceLandscape";
import { useWatchlist } from "@/lib/watchlist";
import { parseDeadlineToDate } from "@/lib/deadlines";
import type { LandscapePoint } from "@/app/page";
import type { Conference, ConferenceDeadline } from "@/lib/types";

export default function HomeClient({
  venues,
  entries,
  landscapePoints,
  totalAStar,
}: {
  venues: Conference[];
  entries: DirectoryEntry[];
  landscapePoints: LandscapePoint[];
  totalAStar: number;
}) {
  const searchParams = useSearchParams();
  const tabParam = searchParams.get("tab");
  const [tabOverride, setTabOverride] = useState<"directory" | "deadlines" | null>(null);
  // URL param wins whenever it changes (e.g. header "Deadlines" link); the
  // local override only applies for in-page tab clicks after that.
  useEffect(() => {
    setTabOverride(null);
  }, [tabParam]);
  const activeTab = tabOverride ?? (tabParam === "deadlines" ? "deadlines" : "directory");

  const [compareIds, setCompareIds] = useState<string[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [showLandscape, setShowLandscape] = useState(false);
  const [capNotice, setCapNotice] = useState(false);
  const [now, setNow] = useState<number>(0);

  useEffect(() => {
    setNow(Date.now());
  }, []);

  const { watchlist } = useWatchlist();

  const venuesWithDeadlines = useMemo(
    () => venues.filter((v) => v.deadlines && v.deadlines.length > 0),
    [venues]
  );

  const urgentWatchlistDeadlines = useMemo(() => {
    if (!watchlist.length || !now) return [];
    const items: { venue: Conference; deadline: ConferenceDeadline; diffDays: number }[] = [];
    for (const id of watchlist) {
      const v = venues.find((x) => x.id === id);
      if (!v?.deadlines) continue;
      for (const d of v.deadlines) {
        const t = parseDeadlineToDate(d.paper_deadline, d.timezone).getTime();
        const diffDays = (t - now) / (1000 * 60 * 60 * 24);
        if (diffDays >= 0 && diffDays <= 30) {
          items.push({ venue: v, deadline: d, diffDays });
        }
      }
    }
    return items.sort((a, b) => a.diffDays - b.diffDays);
  }, [watchlist, venues, now]);

  const toggleCompare = (id: string) => {
    setCompareIds((prev) => {
      if (prev.includes(id)) return prev.filter((x) => x !== id);
      if (prev.length >= 4) {
        setCapNotice(true);
        setTimeout(() => setCapNotice(false), 2500);
        return prev;
      }
      return [...prev, id];
    });
  };

  const removeCompare = (id: string) => {
    setCompareIds((prev) => prev.filter((x) => x !== id));
  };

  const selectedVenues = venues.filter((v) => compareIds.includes(v.id));

  return (
    <>
      {/* Watchlist Urgent Deadlines Reminder Banner */}
      {urgentWatchlistDeadlines.length > 0 && (
        <div className="mb-6 rounded-xl border border-amber-300/80 bg-amber-50/70 p-4 text-xs dark:border-amber-900/60 dark:bg-amber-950/30 shadow-xs flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <span className="text-base">🚨</span>
            <div>
              <span className="font-bold text-amber-950 dark:text-amber-200">
                Target Deadlines Approaching:
              </span>{" "}
              <span className="text-amber-900 dark:text-amber-300">
                You have {urgentWatchlistDeadlines.length} bookmarked deadline
                {urgentWatchlistDeadlines.length === 1 ? "" : "s"} within the next 30 days — nearest is{" "}
                <strong>{urgentWatchlistDeadlines[0].venue.acronym}</strong> in{" "}
                {Math.ceil(urgentWatchlistDeadlines[0].diffDays)} day
                {Math.ceil(urgentWatchlistDeadlines[0].diffDays) === 1 ? "" : "s"}.
              </span>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setTabOverride("deadlines")}
            className="rounded-lg bg-amber-600 px-3 py-1 font-semibold text-white hover:bg-amber-700 transition"
          >
            View Deadlines →
          </button>
        </div>
      )}

      {/* Main Mode Tabs: Venue Directory vs Upcoming Deadlines */}
      <div className="mb-6 flex flex-wrap items-center gap-2 border-b border-border pb-3">
        <button
          type="button"
          onClick={() => setTabOverride("directory")}
          className={`inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-bold transition ${
            activeTab === "directory"
              ? "bg-accent text-accent-contrast shadow-xs"
              : "border border-border bg-surface text-foreground/80 hover:border-stone-400 hover:text-foreground dark:hover:border-stone-600"
          }`}
        >
          <span>📋</span>
          <span>Venue Directory ({entries.length.toLocaleString()})</span>
        </button>

        <button
          type="button"
          onClick={() => setTabOverride("deadlines")}
          className={`inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-bold transition ${
            activeTab === "deadlines"
              ? "bg-accent text-accent-contrast shadow-xs"
              : "border border-border bg-surface text-foreground/80 hover:border-stone-400 hover:text-foreground dark:hover:border-stone-600"
          }`}
        >
          <span>⏰</span>
          <span>Upcoming Deadlines ({venuesWithDeadlines.length.toLocaleString()})</span>
        </button>
      </div>

      {activeTab === "directory" ? (
        <>
          {/* Acceptance Rate & Selectivity Landscape */}
          <div className="mb-8 rounded-xl border border-border bg-surface p-5 shadow-xs">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-base font-bold text-foreground flex items-center gap-2">
                  <span>📊 Conference Selectivity Landscape</span>
                  <span className="text-xs font-normal text-muted">
                    ({landscapePoints.length} venues with acceptance stats)
                  </span>
                </h2>
                <p className="text-xs text-muted mt-0.5">
                  Benchmark acceptance rates across CORE prestige tiers (A* through C) and computer science fields.
                </p>
              </div>
              <button
                onClick={() => setShowLandscape(!showLandscape)}
                className="rounded-lg border border-border px-3 py-1.5 text-xs font-semibold text-foreground/80 hover:bg-stone-100 dark:hover:bg-stone-800 transition"
              >
                {showLandscape ? "Hide Section ▲" : "Show Section ▼"}
              </button>
            </div>

            {showLandscape && (
              <div className="mt-5 pt-5 border-t border-border">
                <AcceptanceLandscape points={landscapePoints} totalAStar={totalAStar} />
              </div>
            )}
          </div>

          <Suspense fallback={<div className="py-12 text-center text-sm text-muted">Loading directory...</div>}>
            <Directory
              venues={entries}
              onCompare={toggleCompare}
              selectedForCompare={compareIds}
            />
          </Suspense>
        </>
      ) : (
        <DeadlinesView venues={venues} />
      )}

      {/* Floating Compare Drawer / Bar */}
      {compareIds.length > 0 && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 flex items-center gap-3 rounded-full border border-border bg-surface/95 px-5 py-2.5 shadow-xl backdrop-blur-md">
          <span className="text-xs font-bold text-foreground">
            {compareIds.length} venue{compareIds.length === 1 ? "" : "s"} selected
          </span>
          <div className="flex gap-1">
            {selectedVenues.map((v) => (
              <span
                key={v.id}
                className="inline-flex items-center gap-1 rounded-full bg-accent-soft px-2 py-0.5 text-xs font-bold text-accent"
              >
                {v.acronym}
                <button onClick={() => removeCompare(v.id)} className="hover:text-red-600">
                  ×
                </button>
              </span>
            ))}
          </div>
          <button
            onClick={() => setShowModal(true)}
            className="rounded-full bg-accent px-3 py-1 text-xs font-semibold text-accent-contrast hover:bg-accent-hover transition"
          >
            Compare Side-by-Side
          </button>
          <button
            onClick={() => setCompareIds([])}
            className="text-xs text-muted hover:text-foreground"
          >
            Clear
          </button>
        </div>
      )}

      {capNotice && (
        <div
          role="status"
          className="fixed bottom-20 left-1/2 -translate-x-1/2 z-40 rounded-full bg-stone-900 px-4 py-2 text-xs font-semibold text-stone-100 shadow-lg dark:bg-stone-100 dark:text-stone-900"
        >
          Compare is limited to 4 venues
        </div>
      )}

      {showModal && (
        <CompareModal
          venues={selectedVenues}
          onClose={() => setShowModal(false)}
          onRemove={removeCompare}
        />
      )}
    </>
  );
}
