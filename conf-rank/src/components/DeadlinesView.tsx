/* eslint-disable react-hooks/set-state-in-effect */
"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import RankBadge from "./RankBadge";
import WatchlistButton from "./WatchlistButton";
import { useWatchlist } from "@/lib/watchlist";
import { ALL_CATEGORIES, type Conference, type ConferenceDeadline } from "@/lib/types";
import {
  parseDeadlineToDate,
  getCountdown,
  formatDeadlineDisplay,
  generateGoogleCalendarUrl,
  downloadIcsFile,
} from "@/lib/deadlines";

const RANK_CHIPS = [
  { value: "A*", label: "A* Flagship" },
  { value: "A", label: "A Premier" },
  { value: "B", label: "B Established" },
  { value: "C", label: "C Recognized" },
] as const;

const PRIMARY_CATEGORIES = [
  "Artificial Intelligence",
  "Machine Learning",
  "Computer Vision & Multimedia",
  "Cybersecurity & Privacy",
  "Data Management & Mining",
  "Distributed Systems & Networks",
  "Software Engineering & PL",
];

export interface VenueWithDeadline {
  id: string;
  acronym: string;
  title: string;
  rank: string;
  categories: string[];
  deadline: ConferenceDeadline;
  ts: number; // precomputed effective-deadline timestamp (ms); NaN if unparseable/missing
}

export default function DeadlinesView({
  venues,
}: {
  venues: Conference[];
}) {
  const [search, setSearch] = useState("");
  const [selectedRanks, setSelectedRanks] = useState<string[]>([]);
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [showAllCats, setShowAllCats] = useState(false);
  const [timeWindow, setTimeWindow] = useState<"30" | "60" | "90" | "all" | "passed">("60");
  const [deadlineType, setDeadlineType] = useState<"paper" | "abstract">("paper");
  const [onlyWatchlist, setOnlyWatchlist] = useState(false);
  const [now, setNow] = useState<number>(0);

  const { watchlist } = useWatchlist();

  const toggle = (arr: string[], v: string, set: (a: string[]) => void) => {
    set(arr.includes(v) ? arr.filter((x) => x !== v) : [...arr, v]);
  };

  // Update current time on mount and every minute
  useEffect(() => {
    setNow(Date.now());
    const timer = setInterval(() => setNow(Date.now()), 60000);
    return () => clearInterval(timer);
  }, []);

  // Flatten all venues and their deadline entries; parse the effective deadline
  // (paper or abstract, per the current toggle) once per mode.
  const allEntries = useMemo(() => {
    const list: VenueWithDeadline[] = [];
    for (const v of venues) {
      if (!v.deadlines || !v.deadlines.length) continue;
      for (const d of v.deadlines) {
        const effective =
          deadlineType === "abstract" ? d.abstract_deadline : d.paper_deadline;
        if (!effective) continue; // abstract mode: skip entries without one
        list.push({
          id: v.id,
          acronym: v.acronym,
          title: v.title,
          rank: v.rank,
          categories: v.categories || [],
          deadline: d,
          ts: parseDeadlineToDate(effective, d.timezone).getTime(),
        });
      }
    }
    return list;
  }, [venues, deadlineType]);

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    // Before hydration `now` is 0 — render nothing rather than filtering
    // against a stale hardcoded date.
    if (!now) return [];
    const currentTime = now;

    return allEntries
      .filter((item) => {
        if (onlyWatchlist && !watchlist.includes(item.id)) return false;

        if (q) {
          const matchAcr = item.acronym.toLowerCase().includes(q);
          const matchTitle = item.title.toLowerCase().includes(q);
          const matchCycle = item.deadline.cycle?.toLowerCase().includes(q);
          if (!matchAcr && !matchTitle && !matchCycle) return false;
        }

        if (selectedRanks.length && !selectedRanks.includes(item.rank)) {
          return false;
        }

        if (
          selectedCategories.length &&
          !item.categories.some((c) => selectedCategories.includes(c))
        ) {
          return false;
        }

        if (isNaN(item.ts)) return false;
        const diffDays = (item.ts - currentTime) / (1000 * 60 * 60 * 24);

        if (timeWindow === "30") return diffDays >= 0 && diffDays <= 30;
        if (timeWindow === "60") return diffDays >= 0 && diffDays <= 60;
        if (timeWindow === "90") return diffDays >= 0 && diffDays <= 90;
        if (timeWindow === "passed") return diffDays < 0 && diffDays >= -60; // passed within last 60 days
        // "all"
        return diffDays >= 0;
      })
      .sort((a, b) => (timeWindow === "passed" ? b.ts - a.ts : a.ts - b.ts));
  }, [allEntries, search, selectedRanks, selectedCategories, timeWindow, onlyWatchlist, watchlist, now]);

  return (
    <div className="space-y-4">
      {/* Search and Filter Controls */}
      <div className="rounded-xl border border-border bg-surface p-4 shadow-xs space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          {/* Search */}
          <div className="relative w-full sm:w-64">
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search deadline or venue…"
              className="w-full rounded-lg border border-border bg-surface px-3 py-1.5 pr-8 text-xs
                         text-foreground placeholder:text-muted
                         focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
            />
            {search && (
              <button
                type="button"
                onClick={() => setSearch("")}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted hover:text-foreground text-xs font-bold"
              >
                ×
              </button>
            )}
          </div>

          {/* Time Window Buttons */}
          <div className="flex flex-wrap items-center gap-1">
            <span className="text-xs font-semibold text-muted mr-1">Timeframe:</span>
            {[
              { id: "30", label: "Next 30 Days" },
              { id: "60", label: "Next 60 Days" },
              { id: "90", label: "Next 90 Days" },
              { id: "all", label: "All Upcoming" },
              { id: "passed", label: "Recently Passed" },
            ].map((tw) => (
              <button
                key={tw.id}
                type="button"
                onClick={() => setTimeWindow(tw.id as typeof timeWindow)}
                className={`rounded-full px-3 py-1 text-xs font-medium transition ${
                  timeWindow === tw.id
                    ? "bg-accent text-accent-contrast shadow-xs"
                    : "border border-border bg-surface text-foreground/80 hover:border-stone-400 hover:text-foreground dark:hover:border-stone-600"
                }`}
              >
                {tw.label}
              </button>
            ))}
          </div>

          {/* Paper/Abstract deadline-type toggle */}
          <div className="flex items-center gap-1">
            <span className="text-xs font-semibold text-muted mr-1">Deadline:</span>
            {[
              { id: "paper", label: "📄 Paper" },
              { id: "abstract", label: "📝 Abstract" },
            ].map((dt) => (
              <button
                key={dt.id}
                type="button"
                onClick={() => setDeadlineType(dt.id as typeof deadlineType)}
                title={
                  dt.id === "abstract"
                    ? "Count down to abstract registration deadlines (venues without one are hidden)"
                    : "Count down to full paper submission deadlines"
                }
                className={`rounded-full px-3 py-1 text-xs font-medium transition ${
                  deadlineType === dt.id
                    ? "bg-accent text-accent-contrast shadow-xs"
                    : "border border-border bg-surface text-foreground/80 hover:border-stone-400 hover:text-foreground dark:hover:border-stone-600"
                }`}
              >
                {dt.label}
              </button>
            ))}
          </div>

          {/* Watchlist toggle */}
          <button
            type="button"
            onClick={() => setOnlyWatchlist(!onlyWatchlist)}
            className={`ml-auto rounded-full px-3 py-1 text-xs font-semibold transition inline-flex items-center gap-1 ${
              onlyWatchlist
                ? "bg-amber-500 text-stone-950 font-bold shadow-xs"
                : "border border-border bg-surface text-foreground/80 hover:border-amber-400 hover:text-amber-600 dark:hover:border-amber-500"
            }`}
          >
            <span>⭐</span>
            <span>Watchlist{watchlist.length > 0 ? ` (${watchlist.length})` : ""}</span>
          </button>
        </div>

        {/* Secondary filters (Rank & Topic multi-select chips) */}
        <div className="space-y-2 pt-2 border-t border-border/70 text-xs">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="font-semibold text-muted">Rank:</span>
            {RANK_CHIPS.map((r) => (
              <button
                key={r.value}
                type="button"
                onClick={() => toggle(selectedRanks, r.value, setSelectedRanks)}
                className={`rounded-full px-3 py-1 text-xs font-medium transition ${
                  selectedRanks.includes(r.value)
                    ? "bg-accent text-accent-contrast shadow-xs"
                    : "border border-border bg-surface text-foreground/80 hover:border-stone-400 hover:text-foreground dark:hover:border-stone-600"
                }`}
              >
                {r.label}
              </button>
            ))}
          </div>

          <div className="flex flex-wrap items-center gap-1.5">
            <span className="font-semibold text-muted">Topic:</span>
            {(showAllCats
              ? ALL_CATEGORIES
              : ALL_CATEGORIES.filter(
                  (cat) =>
                    PRIMARY_CATEGORIES.includes(cat) || selectedCategories.includes(cat)
                )
            ).map((cat) => (
              <button
                key={cat}
                type="button"
                onClick={() => toggle(selectedCategories, cat as string, setSelectedCategories)}
                className={`rounded-full px-3 py-1 text-xs font-medium transition ${
                  selectedCategories.includes(cat)
                    ? "bg-accent text-accent-contrast shadow-xs"
                    : "border border-border bg-surface text-foreground/80 hover:border-stone-400 hover:text-foreground dark:hover:border-stone-600"
                }`}
              >
                {cat}
              </button>
            ))}
            {ALL_CATEGORIES.length > PRIMARY_CATEGORIES.length && (
              <button
                type="button"
                onClick={() => setShowAllCats(!showAllCats)}
                className="rounded-full border border-dashed border-border px-3 py-1 text-xs font-semibold text-muted hover:border-accent hover:text-accent transition"
              >
                {showAllCats
                  ? "Show fewer ▴"
                  : `+ ${ALL_CATEGORIES.length - PRIMARY_CATEGORIES.length} more ▾`}
              </button>
            )}
          </div>

          <div className="flex items-center">
            {(selectedRanks.length > 0 || selectedCategories.length > 0 || search) && (
              <button
                type="button"
                onClick={() => {
                  setSelectedRanks([]);
                  setSelectedCategories([]);
                  setSearch("");
                }}
                className="rounded-full px-3 py-1 text-xs font-medium text-muted underline-offset-2 hover:underline"
              >
                Clear filters
              </button>
            )}
            <span className="ml-auto text-xs text-muted">
              Found {filtered.length} deadline{filtered.length === 1 ? "" : "s"}
              {deadlineType === "abstract" ? " (abstract)" : ""}
            </span>
          </div>
        </div>
      </div>

      {/* Deadlines Grid */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {filtered.map((item, idx) => {
          const targetDate = new Date(item.ts);
          const countdown = getCountdown(targetDate);
          const effectiveStr =
            deadlineType === "abstract"
              ? (item.deadline.abstract_deadline as string) // present: entries without one are filtered out
              : item.deadline.paper_deadline;
          const display = formatDeadlineDisplay(effectiveStr, item.deadline.timezone);
          const gcalUrl = generateGoogleCalendarUrl(item, item.deadline, deadlineType);
          const dlLabel =
            deadlineType === "abstract" ? "Abstract Due:" : "Paper Deadline:";

          return (
            <div
              key={`${item.id}-${item.deadline.paper_deadline}-${deadlineType}-${idx}`}
              className="flex flex-col justify-between rounded-xl border border-border bg-surface p-4 shadow-xs hover:border-stone-400 dark:hover:border-stone-600 transition"
            >
              <div>
                {/* Top Row: Acronym + Rank + Watchlist + Countdown */}
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <RankBadge rank={item.rank} size="sm" />
                    <Link
                      href={`/conference/${item.id}`}
                      className="font-bold text-base text-foreground hover:underline truncate"
                    >
                      {item.acronym}
                    </Link>
                    <WatchlistButton venueId={item.id} acronym={item.acronym} size="sm" />
                  </div>

                  {countdown.isPassed ? (
                    <span className="rounded-full bg-stone-100 px-2.5 py-0.5 text-[11px] font-semibold text-muted dark:bg-stone-800 shrink-0">
                      Passed
                    </span>
                  ) : countdown.days === 0 && countdown.hours < 48 ? (
                    <span className="animate-pulse rounded-full bg-amber-500/20 px-2.5 py-0.5 text-[11px] font-bold text-amber-700 dark:text-amber-400 ring-1 ring-amber-500/30 shrink-0">
                      🚨 {countdown.hours}h left
                    </span>
                  ) : (
                    <span className="rounded-full bg-accent-soft px-2.5 py-0.5 text-[11px] font-bold text-accent ring-1 ring-accent/20 shrink-0">
                      ⏳ {countdown.days}d {countdown.hours}h left
                    </span>
                  )}
                </div>

                <p className="mt-1 text-xs text-muted line-clamp-1">
                  {item.title}
                </p>

                {/* Deadline Info */}
                <div className="mt-3 rounded-lg border border-border/80 bg-stone-50/50 p-2.5 dark:bg-stone-900/30 text-xs space-y-1">
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="font-semibold text-foreground">
                      {dlLabel}
                    </span>
                    <span className="font-bold text-foreground">
                      {display.localDate}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-[11px] text-muted">
                    <span>
                      {item.deadline.cycle ? `Cycle: ${item.deadline.cycle}` : "Main Track"}
                    </span>
                    <span>{display.originalWithTz}</span>
                  </div>

                  {item.deadline.abstract_deadline && deadlineType === "paper" && (
                    <div className="pt-1 border-t border-border/50 text-[11px] flex justify-between text-muted">
                      <span>Abstract Due:</span>
                      <span className="font-medium text-foreground/90">
                        {formatDeadlineDisplay(item.deadline.abstract_deadline, item.deadline.timezone).localDate}
                      </span>
                    </div>
                  )}

                  {deadlineType === "abstract" && (
                    <div className="pt-1 border-t border-border/50 text-[11px] flex justify-between text-muted">
                      <span>Paper Deadline:</span>
                      <span className="font-medium text-foreground/90">
                        {formatDeadlineDisplay(item.deadline.paper_deadline, item.deadline.timezone).localDate}
                      </span>
                    </div>
                  )}
                </div>

                {(item.deadline.location || item.deadline.conference_dates) && (
                  <div className="mt-2 text-[11px] text-muted flex items-center gap-1.5 truncate">
                    <span>📍</span>
                    <span className="truncate">
                      {[item.deadline.location, item.deadline.conference_dates].filter(Boolean).join(" • ")}
                    </span>
                  </div>
                )}
              </div>

              {/* Action Buttons */}
              <div className="mt-4 flex items-center gap-2 pt-2.5 border-t border-border/60">
                <a
                  href={gcalUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  title="Add deadline to Google Calendar"
                  className="rounded-md border border-border bg-surface px-2.5 py-1 text-xs font-semibold text-foreground/90 hover:border-accent hover:text-accent transition inline-flex items-center gap-1 shadow-2xs"
                >
                  <span>📅</span>
                  <span>Google Cal</span>
                </a>
                <button
                  type="button"
                  onClick={() => downloadIcsFile(item, item.deadline, deadlineType)}
                  title="Download iCalendar (.ics) file"
                  className="rounded-md border border-border bg-surface px-2.5 py-1 text-xs font-semibold text-foreground/90 hover:border-accent hover:text-accent transition inline-flex items-center gap-1 shadow-2xs"
                >
                  <span>📥</span>
                  <span>.ics</span>
                </button>
                {item.deadline.cfp_url && (
                  <a
                    href={item.deadline.cfp_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="ml-auto rounded-md bg-accent px-2.5 py-1 text-xs font-semibold text-accent-contrast hover:bg-accent-hover transition inline-flex items-center gap-1 shadow-2xs"
                  >
                    <span>CFP</span>
                    <span>↗</span>
                  </a>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {!now && (
        <div className="rounded-xl border border-border bg-surface p-12 text-center shadow-xs">
          <p className="text-xs text-muted">Loading deadlines…</p>
        </div>
      )}

      {now !== 0 && filtered.length === 0 && (
        <div className="rounded-xl border border-border bg-surface p-12 text-center shadow-xs">
          <span className="text-3xl block mb-2">🗓️</span>
          <h3 className="text-sm font-bold text-foreground">No deadlines found matching your filters</h3>
          <p className="mt-1 text-xs text-muted">
            Try expanding the timeframe to &quot;All Upcoming&quot; or clearing specific category filters.
          </p>
          <button
            type="button"
            onClick={() => {
              setSearch("");
              setSelectedRanks([]);
              setSelectedCategories([]);
              setTimeWindow("all");
              setDeadlineType("paper");
              setOnlyWatchlist(false);
            }}
            className="mt-4 rounded-lg bg-accent px-3 py-1.5 text-xs font-semibold text-accent-contrast hover:bg-accent-hover transition"
          >
            Reset Filters
          </button>
        </div>
      )}
    </div>
  );
}
