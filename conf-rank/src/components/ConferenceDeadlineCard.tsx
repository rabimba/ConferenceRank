/* eslint-disable react-hooks/set-state-in-effect */
"use client";

import { useEffect, useState, useMemo } from "react";
import type { ConferenceDeadline } from "@/lib/types";
import {
  parseDeadlineToDate,
  getCountdown,
  formatDeadlineDisplay,
  generateGoogleCalendarUrl,
  downloadIcsFile,
} from "@/lib/deadlines";

export default function ConferenceDeadlineCard({
  venue,
  deadline: propDeadline,
  deadlines,
}: {
  venue: { acronym: string; title: string };
  deadline?: ConferenceDeadline;
  deadlines?: ConferenceDeadline[] | null;
}) {
  const [now, setNow] = useState<number>(0);

  // Update countdown every 60 seconds
  useEffect(() => {
    setNow(Date.now());
    const timer = setInterval(() => setNow(Date.now()), 60000);
    return () => clearInterval(timer);
  }, []);

  const deadline = useMemo(() => {
    if (propDeadline) return propDeadline;
    if (!deadlines || !deadlines.length) return null;
    const currentTime = now || 1773700000000;
    const sorted = [...deadlines].sort(
      (a, b) =>
        parseDeadlineToDate(a.paper_deadline, a.timezone).getTime() -
        parseDeadlineToDate(b.paper_deadline, b.timezone).getTime()
    );
    const future = sorted.find(
      (d) =>
        parseDeadlineToDate(d.paper_deadline, d.timezone).getTime() >=
        currentTime - 86400000 * 14
    );
    return future || sorted[sorted.length - 1];
  }, [propDeadline, deadlines, now]);

  if (!deadline) return null;

  const targetDate = parseDeadlineToDate(deadline.paper_deadline, deadline.timezone);
  const countdown = getCountdown(targetDate);
  const display = formatDeadlineDisplay(deadline.paper_deadline, deadline.timezone);
  const gcalUrl = generateGoogleCalendarUrl(venue, deadline);

  return (
    <div className="rounded-xl border border-border bg-gradient-to-br from-surface via-surface to-accent-soft/20 p-5 shadow-xs">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className="grid size-7 place-items-center rounded-lg bg-accent text-accent-contrast text-sm font-bold">
            ⏰
          </span>
          <div>
            <h3 className="text-sm font-bold text-foreground">
              {deadline.year} Submission Deadline
              {deadline.cycle ? ` — ${deadline.cycle}` : ""}
            </h3>
            <p className="text-xs text-muted">
              {deadline.timezone ? `${deadline.timezone} timezone` : "Anywhere on Earth (AoE)"}
            </p>
          </div>
        </div>

        {/* Countdown Badge */}
        <div>
          {countdown.isPassed ? (
            <span className="rounded-full bg-stone-100 px-3 py-1 text-xs font-semibold text-muted dark:bg-stone-800">
              Deadline Passed
            </span>
          ) : countdown.days === 0 && countdown.hours < 48 ? (
            <span className="animate-pulse rounded-full bg-amber-500/20 px-3 py-1 text-xs font-bold text-amber-700 dark:text-amber-400 ring-1 ring-amber-500/40">
              🚨 {countdown.hours}h {countdown.minutes}m left
            </span>
          ) : (
            <span className="rounded-full bg-accent-soft px-3 py-1 text-xs font-bold text-accent ring-1 ring-accent/20">
              ⏳ {countdown.days}d {countdown.hours}h left
            </span>
          )}
        </div>
      </div>

      <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 text-xs border-t border-border pt-4">
        <div>
          <span className="font-semibold text-muted block">Paper Submission</span>
          <span className="font-bold text-foreground text-sm block mt-0.5">
            {display.localDate}
          </span>
          <span className="text-[11px] text-muted">
            {display.originalWithTz}
          </span>
        </div>

        {deadline.abstract_deadline && (
          <div>
            <span className="font-semibold text-muted block">Abstract Registration</span>
            <span className="font-bold text-foreground text-sm block mt-0.5">
              {formatDeadlineDisplay(deadline.abstract_deadline, deadline.timezone).localDate}
            </span>
            <span className="text-[11px] text-muted">Mandatory prior to paper submission</span>
          </div>
        )}

        {(deadline.location || deadline.conference_dates) && (
          <div>
            <span className="font-semibold text-muted block">Conference Dates & Location</span>
            <span className="font-medium text-foreground block mt-0.5">
              {deadline.conference_dates || "Dates TBA"}
            </span>
            <span className="text-[11px] text-muted">
              {deadline.location || "Location TBA"}
            </span>
          </div>
        )}
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-2 pt-3 border-t border-border/60">
        <a
          href={gcalUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-surface px-3 py-1.5 text-xs font-semibold text-foreground/90 hover:border-accent hover:text-accent shadow-2xs transition"
        >
          <span>📅</span>
          <span>Google Calendar</span>
        </a>
        <button
          type="button"
          onClick={() => downloadIcsFile(venue, deadline)}
          className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-surface px-3 py-1.5 text-xs font-semibold text-foreground/90 hover:border-accent hover:text-accent shadow-2xs transition"
        >
          <span>📥</span>
          <span>Download .ics</span>
        </button>
        {deadline.cfp_url && (
          <a
            href={deadline.cfp_url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 rounded-lg bg-accent px-3 py-1.5 text-xs font-semibold text-accent-contrast hover:bg-accent-hover ml-auto shadow-2xs transition"
          >
            <span>Call for Papers</span>
            <span>↗</span>
          </a>
        )}
      </div>
    </div>
  );
}
