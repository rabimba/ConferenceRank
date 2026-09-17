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

export interface VenueWithDeadline {
  id: string;
  acronym: string;
  title: string;
  rank: string;
  categories: string[];
  deadline: ConferenceDeadline;
}

export default function DeadlinesView({
  venues,
}: {
  venues: Conference[];
}) {
  const [search, setSearch] = useState("");
  const [selectedRank, setSelectedRank] = useState<string>("all");
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [timeWindow, setTimeWindow] = useState<"30" | "60" | "90" | "all" | "passed">("60");
  const [onlyWatchlist, setOnlyWatchlist] = useState(false);
  const [, setTick] = useState(0);

  const { watchlist } = useWatchlist();

  // Re-calculate countdowns every minute
  useEffect(() => {
    const timer = setInterval(() => setTick((t) => t + 1), 60000);
    return () => clearInterval(timer);
  }, []);

  // Flatten all venues and their deadline entries
  const allEntries = useMemo(() => {
    const list: VenueWithDeadline[] = [];
    for (const v of venues) {
      if (!v.deadlines || !v.deadlines.length) continue;
      for (const d of v.deadlines) {
        list.push({
          id: v.id,
          acronym: v.acronym,
          title: v.title,
          rank: v.rank,
          categories: v.categories || [],
          deadline: d,
        });
      }
    }
    return list;
  }, [venues]);

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    const now = Date.now();

    return allEntries
      .filter((item) => {
        if (onlyWatchlist && !watchlist.includes(item.id)) return false;

        if (q) {
          const matchAcr = item.acronym.toLowerCase().includes(q);
          const matchTitle = item.title.toLowerCase().includes(q);
          const matchCycle = item.deadline.cycle?.toLowerCase().includes(q);
          if (!matchAcr && !matchTitle && !matchCycle) return false;
        }

        if (selectedRank !== "all" && item.rank !== selectedRank) {
          return false;
        }

        if (selectedCategory !== "all" && !item.categories.includes(selectedCategory)) {
          return false;
        }

        const targetDate = parseDeadlineToDate(item.deadline.paper_deadline, item.deadline.timezone);
        const diffDays = (targetDate.getTime() - now) / (1000 * 60 * 60 * 24);

        if (timeWindow === "30") return diffDays >= 0 && diffDays <= 30;
        if (timeWindow === "60") return diffDays >= 0 && diffDays <= 60;
        if (timeWindow === "90") return diffDays >= 0 && diffDays <= 90;
        if (timeWindow === "passed") return diffDays < 0 && diffDays >= -60; // passed within last 60 days
        // "all"
        return diffDays >= 0;
      })
      .sort((a, b) => {
        const dateA = parseDeadlineToDate(a.deadline.paper_deadline, a.deadline.timezone).getTime();
        const dateB = parseDeadlineToDate(b.deadline.paper_deadline, b.deadline.timezone).getTime();
        return timeWindow === "passed" ? dateB - dateA : dateA - dateB;
      });
  }, [allEntries, search, selectedRank, selectedCategory, timeWindow, onlyWatchlist, watchlist]);

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

        {/* Secondary filters (Rank & Topic) */}
        <div className="flex flex-wrap items-center gap-3 pt-2 border-t border-border/70 text-xs">
          <div className="flex items-center gap-1.5">
            <span className="font-semibold text-muted">Rank:</span>
            <select
              value={selectedRank}
              onChange={(e) => setSelectedRank(e.target.value)}
              className="rounded-md border border-border bg-surface px-2 py-1 text-xs text-foreground focus:border-accent focus:outline-none"
            >
              <option value="all">All Tiers</option>
              <option value="A*">A* Flagship</option>
              <option value="A">A Premier</option>
              <option value="B">B Established</option>
              <option value="C">C Recognized</option>
            </select>
          </div>

          <div className="flex items-center gap-1.5">
            <span className="font-semibold text-muted">Topic:</span>
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="rounded-md border border-border bg-surface px-2 py-1 text-xs text-foreground focus:border-accent focus:outline-none max-w-[220px]"
            >
              <option value="all">All Disciplines</option>
              {ALL_CATEGORIES.map((cat) => (
                <option key={cat} value={cat}>
                  {cat}
                </option>
              ))}
            </select>
          </div>

          <span className="ml-auto text-xs text-muted">
            Found {filtered.length} deadline{filtered.length === 1 ? "" : "s"}
          </span>
        </div>
      </div>

      {/* Deadlines Grid */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {filtered.map((item, idx) => {
          const targetDate = parseDeadlineToDate(item.deadline.paper_deadline, item.deadline.timezone);
          const countdown = getCountdown(targetDate);
          const display = formatDeadlineDisplay(item.deadline.paper_deadline, item.deadline.timezone);
          const gcalUrl = generateGoogleCalendarUrl(item, item.deadline);

          return (
            <div
              key={`${item.id}-${item.deadline.paper_deadline}-${idx}`}
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
                      Paper Deadline:
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

                  {item.deadline.abstract_deadline && (
                    <div className="pt-1 border-t border-border/50 text-[11px] flex justify-between text-muted">
                      <span>Abstract Due:</span>
                      <span className="font-medium text-foreground/90">
                        {formatDeadlineDisplay(item.deadline.abstract_deadline, item.deadline.timezone).localDate}
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
                  onClick={() => downloadIcsFile(item, item.deadline)}
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

      {filtered.length === 0 && (
        <div className="rounded-xl border border-border bg-surface p-12 text-center shadow-xs">
          <span className="text-3xl block mb-2">🗓️</span>
          <h3 className="text-sm font-bold text-foreground">No deadlines found matching your filters</h3>
          <p className="mt-1 text-xs text-muted">
            Try expanding the timeframe to "All Upcoming" or clearing specific category filters.
          </p>
          <button
            type="button"
            onClick={() => {
              setSearch("");
              setSelectedRank("all");
              setSelectedCategory("all");
              setTimeWindow("all");
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
