import type { ConferenceDeadline } from "./types";

/**
 * Resolves an IANA timezone name (e.g. "Asia/Tokyo", "America/Los_Angeles")
 * to its UTC offset at a specific instant, honoring DST. Returns null if the
 * runtime cannot resolve the zone.
 */
function resolveIanaOffset(iana: string, at: Date): string | null {
  try {
    const dtf = new Intl.DateTimeFormat("en-US", {
      timeZone: iana,
      timeZoneName: "longOffset",
    });
    const part = dtf.formatToParts(at).find((p) => p.type === "timeZoneName");
    if (!part) return null;
    // "GMT+9", "GMT-07:00", or "GMT" (zero offset)
    const m = part.value.match(/^GMT(?:([+-])(\d{1,2})(?::(\d{2}))?)?$/);
    if (!m) return null;
    if (!m[1]) return "Z";
    return `${m[1]}${m[2].padStart(2, "0")}:${(m[3] ?? "00").padStart(2, "0")}`;
  } catch {
    return null; // unknown IANA name
  }
}

/**
 * Normalizes timezone string to an ISO offset or recognized specifier.
 * AoE (Anywhere on Earth) is UTC-12.
 *
 * `at` anchors IANA-zone resolution to the deadline date so DST is correct.
 * Unknown zones log a warning and fall back to AoE.
 */
export function normalizeTimezoneOffset(tz?: string | null, at?: Date): string {
  if (!tz) return "-12:00"; // default to AoE
  const clean = tz.trim();
  if (clean.toUpperCase() === "AOE") return "-12:00";
  if (clean.toUpperCase() === "UTC" || clean.toUpperCase() === "GMT") return "Z";

  // Format "UTC-12", "UTC+8", "GMT+2"
  const utcMatch = clean.match(/^(?:UTC|GMT)([+-])(\d{1,2})(?::(\d{2}))?$/i);
  if (utcMatch) {
    const sign = utcMatch[1];
    const hours = utcMatch[2].padStart(2, "0");
    const mins = utcMatch[3] ? utcMatch[3].padStart(2, "0") : "00";
    return `${sign}${hours}:${mins}`;
  }

  // POSIX "Etc/GMT+8" means UTC-8
  const etcMatch = clean.match(/^Etc\/GMT([+-])(\d{1,2})$/i);
  if (etcMatch) {
    const sign = etcMatch[1] === "+" ? "-" : "+";
    const hours = etcMatch[2].padStart(2, "0");
    return `${sign}${hours}:00`;
  }

  // IANA zones (e.g. "America/Los_Angeles", "Asia/Tokyo") and common aliases.
  // Resolve at the deadline date so PST vs PDT is correct.
  const ALIASES: Record<string, string> = {
    PT: "America/Los_Angeles", PST: "America/Los_Angeles", PDT: "America/Los_Angeles",
    ET: "America/New_York", EST: "America/New_York", EDT: "America/New_York",
    CT: "America/Chicago", CST: "America/Chicago", CDT: "America/Chicago",
    MT: "America/Denver", MST: "America/Denver", MDT: "America/Denver",
    CET: "Europe/Paris", CEST: "Europe/Paris",
    BST: "Europe/London",
    JST: "Asia/Tokyo",
    AEST: "Australia/Sydney", AEDT: "Australia/Sydney",
  };
  const iana = ALIASES[clean.toUpperCase()] ?? (clean.includes("/") ? clean : null);
  if (iana) {
    const resolved = resolveIanaOffset(iana, at ?? new Date());
    if (resolved) return resolved;
  }

  if (typeof console !== "undefined") {
    console.warn(`[deadlines] unrecognized timezone "${tz}"; falling back to AoE (UTC-12)`);
  }
  return "-12:00";
}

/**
 * Parses a deadline string into a JavaScript Date object.
 */
export function parseDeadlineToDate(deadlineStr: string, timezoneStr?: string | null): Date {
  // Clean whitespace
  const raw = deadlineStr.trim();

  // Normalize date and time portions
  let datePart = raw;
  let timePart = "23:59:59";

  if (raw.includes(" ")) {
    const parts = raw.split(" ");
    datePart = parts[0];
    timePart = parts[1];
    if (timePart.split(":").length === 2) {
      timePart += ":00";
    }
  } else if (raw.includes("T")) {
    const parts = raw.split("T");
    datePart = parts[0];
    timePart = parts[1].replace("Z", "");
    if (timePart.split(":").length === 2) {
      timePart += ":00";
    }
  }

  // Resolve IANA offsets at the deadline date (DST-correct). A preliminary
  // parse at UTC gives the approximate instant; 1h boundary skew is harmless.
  const approx = new Date(`${datePart}T${timePart}Z`);
  const anchor = isNaN(approx.getTime()) ? new Date() : approx;
  const offset = normalizeTimezoneOffset(timezoneStr, anchor);
  const isoStr = offset === "Z" ? `${datePart}T${timePart}Z` : `${datePart}T${timePart}${offset}`;

  const parsed = new Date(isoStr);
  if (isNaN(parsed.getTime())) {
    // Fallback: standard Date parse (browser-local tz). Logged — callers that
    // render raw strings on invalid dates should see this in the console.
    console.warn(`[deadlines] could not parse "${deadlineStr}" with tz "${timezoneStr}"; using local parse`);
    return new Date(raw);
  }
  return parsed;
}

export interface CountdownResult {
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
  isPassed: boolean;
  totalSeconds: number;
}

/**
 * Calculates remaining time until target date.
 */
export function getCountdown(targetDate: Date): CountdownResult {
  const now = Date.now();
  const diffMs = targetDate.getTime() - now;
  if (diffMs <= 0) {
    return { days: 0, hours: 0, minutes: 0, seconds: 0, isPassed: true, totalSeconds: 0 };
  }

  const totalSeconds = Math.floor(diffMs / 1000);
  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  return { days, hours, minutes, seconds, isPassed: false, totalSeconds };
}

/**
 * Formats countdown into human-friendly string like "14d 6h left" or "3h 12m left".
 */
export function formatCountdown(targetDate: Date): string {
  const c = getCountdown(targetDate);
  if (c.isPassed) return "Deadline passed";
  if (c.days > 0) return `${c.days}d ${c.hours}h left`;
  if (c.hours > 0) return `${c.hours}h ${c.minutes}m left`;
  return `${c.minutes}m ${c.seconds}s left`;
}

/**
 * Formats a deadline for readable calendar/card display.
 */
export function formatDeadlineDisplay(deadlineStr: string, timezoneStr?: string | null): {
  localDate: string;
  originalWithTz: string;
} {
  const d = parseDeadlineToDate(deadlineStr, timezoneStr);
  const localDate = isNaN(d.getTime())
    ? deadlineStr
    : d.toLocaleDateString(undefined, {
        month: "short",
        day: "numeric",
        year: "numeric",
        hour: "numeric",
        minute: "2-digit",
      });

  const tzLabel = timezoneStr ? timezoneStr.toUpperCase() : "AOE";
  const originalWithTz = `${deadlineStr.slice(0, 16)} (${tzLabel})`;

  return { localDate, originalWithTz };
}

/**
 * Resolves which deadline string a calendar/ICS export should target.
 * Abstract mode falls back to the paper deadline when no abstract date exists.
 */
function resolveDeadlineTarget(
  deadline: ConferenceDeadline,
  kind: "paper" | "abstract"
): { dateStr: string; isAbstract: boolean } {
  if (kind === "abstract" && deadline.abstract_deadline) {
    return { dateStr: deadline.abstract_deadline, isAbstract: true };
  }
  return { dateStr: deadline.paper_deadline, isAbstract: false };
}

/**
 * Generates 1-click Google Calendar URL for a conference deadline.
 */
export function generateGoogleCalendarUrl(
  venue: { acronym: string; title: string },
  deadline: ConferenceDeadline,
  kind: "paper" | "abstract" = "paper"
): string {
  const { dateStr, isAbstract } = resolveDeadlineTarget(deadline, kind);
  const targetDate = parseDeadlineToDate(dateStr, deadline.timezone);
  if (isNaN(targetDate.getTime())) return "#"; // unparseable deadline — no calendar event
  const endIso = targetDate.toISOString().replace(/[-:]/g, "").split(".")[0] + "Z";
  // 2 hours event window
  const startDate = new Date(targetDate.getTime() - 2 * 60 * 60 * 1000);
  const startIso = startDate.toISOString().replace(/[-:]/g, "").split(".")[0] + "Z";

  const title = isAbstract
    ? `${venue.acronym} ${deadline.year} Abstract Registration Deadline`
    : `${venue.acronym} ${deadline.year} Paper Submission Deadline`;
  let details = `${venue.title}\n\n${isAbstract ? "Abstract" : "Paper"} Deadline: ${dateStr} (${deadline.timezone || "AoE"})`;
  if (isAbstract) details += `\nPaper Deadline: ${deadline.paper_deadline} (${deadline.timezone || "AoE"})`;
  if (deadline.cycle) details += `\nTrack/Cycle: ${deadline.cycle}`;
  if (deadline.cfp_url) details += `\nCFP & Submission: ${deadline.cfp_url}`;
  if (deadline.conference_dates) details += `\nConference Dates: ${deadline.conference_dates}`;
  if (deadline.location) details += `\nLocation: ${deadline.location}`;

  const params = new URLSearchParams({
    action: "TEMPLATE",
    text: title,
    dates: `${startIso}/${endIso}`,
    details: details,
    location: deadline.location || "",
  });

  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}

/**
 * Generates an RFC 5545 iCalendar (.ics) string.
 */
export function generateIcsContent(
  venue: { acronym: string; title: string },
  deadline: ConferenceDeadline,
  kind: "paper" | "abstract" = "paper"
): string {
  const { dateStr, isAbstract } = resolveDeadlineTarget(deadline, kind);
  const targetDate = parseDeadlineToDate(dateStr, deadline.timezone);
  if (isNaN(targetDate.getTime())) return ""; // unparseable deadline — empty ICS
  const endIso = targetDate.toISOString().replace(/[-:]/g, "").split(".")[0] + "Z";
  const startDate = new Date(targetDate.getTime() - 2 * 60 * 60 * 1000);
  const startIso = startDate.toISOString().replace(/[-:]/g, "").split(".")[0] + "Z";
  const nowIso = new Date().toISOString().replace(/[-:]/g, "").split(".")[0] + "Z";

  const uid = `${venue.acronym}-${deadline.year}-${isAbstract ? "abs" : "paper"}-${targetDate.getTime()}@conferencerank.org`;
  const summary = isAbstract
    ? `${venue.acronym} ${deadline.year} Abstract Registration Deadline`
    : `${venue.acronym} ${deadline.year} Paper Submission Deadline`;
  let description = `${venue.title}\\n\\n${isAbstract ? "Abstract" : "Paper"} Deadline: ${dateStr} (${deadline.timezone || "AoE"})`;
  if (isAbstract) description += `\\nPaper Deadline: ${deadline.paper_deadline} (${deadline.timezone || "AoE"})`;
  if (deadline.cycle) description += `\\nCycle: ${deadline.cycle}`;
  if (deadline.cfp_url) description += `\\nCFP: ${deadline.cfp_url}`;

  return [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//ConferenceRank//Deadlines//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "BEGIN:VEVENT",
    `UID:${uid}`,
    `DTSTAMP:${nowIso}`,
    `DTSTART:${startIso}`,
    `DTEND:${endIso}`,
    `SUMMARY:${summary}`,
    `DESCRIPTION:${description}`,
    `LOCATION:${deadline.location || ""}`,
    "STATUS:CONFIRMED",
    "END:VEVENT",
    "END:VCALENDAR",
  ].join("\r\n");
}

/**
 * Triggers browser download of .ics file.
 */
export function downloadIcsFile(
  venue: { acronym: string; title: string },
  deadline: ConferenceDeadline,
  kind: "paper" | "abstract" = "paper"
): void {
  if (typeof window === "undefined") return;
  const icsText = generateIcsContent(venue, deadline, kind);
  if (!icsText) return; // unparseable deadline
  const blob = new Blob([icsText], { type: "text/calendar;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `${venue.acronym}_${deadline.year}${kind === "abstract" ? "_abstract" : ""}_deadline.ics`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
