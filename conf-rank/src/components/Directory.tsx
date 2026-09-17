/* eslint-disable react-hooks/set-state-in-effect */
"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import RankBadge from "./RankBadge";
import { ALL_CATEGORIES } from "@/lib/types";
import { rankOrder } from "@/lib/ranks";

export interface DirectoryEntry {
  id: string;
  acronym: string;
  title: string;
  rank: string;
  categories: string[];
  has_stats: boolean;
  latest_rate: number | null;
  latest_accepted: number | null;
}

const RANKS = [
  { value: "A*", label: "A*" },
  { value: "A", label: "A" },
  { value: "B", label: "B" },
  { value: "C", label: "C" },
  { value: "Australasian B", label: "Aus B" },
  { value: "Australasian C", label: "Aus C" },
  { value: "National", label: "National" },
  { value: "Unranked", label: "Unranked" },
] as const;
const PAGE_SIZE = 50;

const PRIMARY_CATEGORIES = [
  "Artificial Intelligence",
  "Machine Learning",
  "Computer Vision & Multimedia",
  "Cybersecurity & Privacy",
  "Data Management & Mining",
  "Distributed Systems & Networks",
  "Software Engineering & PL",
];

type SortKey = "rank" | "rate" | "accepted" | "acronym" | "title";

function readUrl(): {
  q: string;
  cats: string[];
  ranks: string[];
  sort: SortKey;
  dir: "asc" | "desc";
  page: number;
} {
  if (typeof window === "undefined")
    return { q: "", cats: [], ranks: [], sort: "rank", dir: "asc", page: 1 };
  const p = new URLSearchParams(window.location.search);
  const rawSort = p.get("sort");
  const validSort: SortKey =
    rawSort === "rate" || rawSort === "accepted" || rawSort === "acronym" || rawSort === "title"
      ? rawSort
      : "rank";
  const rawDir = p.get("dir");
  const validDir: "asc" | "desc" = rawDir === "desc" ? "desc" : "asc";
  return {
    q: p.get("q") ?? "",
    cats: (p.get("cats") ?? "").split(",").filter(Boolean),
    ranks: (p.get("ranks") ?? "").split(",").filter(Boolean),
    sort: validSort,
    dir: validDir,
    page: Math.max(1, parseInt(p.get("page") ?? "1", 10) || 1),
  };
}

function writeUrl(
  q: string,
  cats: string[],
  ranks: string[],
  sort: SortKey,
  dir: "asc" | "desc",
  page: number
) {
  if (typeof window === "undefined") return;
  const p = new URLSearchParams();
  if (q) p.set("q", q);
  if (cats.length) p.set("cats", cats.join(","));
  if (ranks.length) p.set("ranks", ranks.join(","));
  if (sort !== "rank") p.set("sort", sort);
  if (dir !== "asc") p.set("dir", dir);
  if (page > 1) p.set("page", String(page));
  const qs = p.toString();
  window.history.replaceState(null, "", qs ? `?${qs}` : window.location.pathname);
}

export default function Directory({
  venues,
  onCompare,
  selectedForCompare = [],
}: {
  venues: DirectoryEntry[];
  onCompare?: (id: string) => void;
  selectedForCompare?: string[];
}) {
  const [search, setSearch] = useState("");
  const [cats, setCats] = useState<string[]>([]);
  const [ranks, setRanks] = useState<string[]>([]);
  const [sort, setSort] = useState<SortKey>("rank");
  const [dir, setDir] = useState<"asc" | "desc">("asc");
  const [page, setPage] = useState(1);
  const [hydrated, setHydrated] = useState(false);
  const [showAllCats, setShowAllCats] = useState(false);

  // hydrate filter state from the URL once on mount
  useEffect(() => {
    const u = readUrl();
    setSearch(u.q);
    setCats(u.cats);
    setRanks(u.ranks);
    setSort(u.sort);
    setDir(u.dir);
    setPage(u.page);
    setHydrated(true);
  }, []);

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    let list = venues.filter((c) => {
      if (q && !c.title.toLowerCase().includes(q) && !c.acronym.toLowerCase().includes(q))
        return false;
      if (cats.length && !c.categories.some((cat) => cats.includes(cat))) return false;
      if (ranks.length) {
        const matches = ranks.some((r) => {
          if (r === "National") return c.rank.startsWith("National");
          if (r === "Unranked") return c.rank.toLowerCase().startsWith("unranked");
          return c.rank === r;
        });
        if (!matches) return false;
      }
      return true;
    });
    const mul = dir === "asc" ? 1 : -1;
    list = [...list].sort((a, b) => {
      switch (sort) {
        case "rank":
          return (rankOrder(a.rank) - rankOrder(b.rank)) * mul ||
            a.acronym.localeCompare(b.acronym);
        case "rate": {
          const aHas = a.latest_rate != null;
          const bHas = b.latest_rate != null;
          if (aHas !== bHas) return aHas ? -1 : 1;
          if (a.latest_rate != null && b.latest_rate != null) {
            const diff = (a.latest_rate - b.latest_rate) * mul;
            if (diff !== 0) return diff;
          }
          return a.acronym.localeCompare(b.acronym);
        }
        case "accepted": {
          const aHas = a.latest_accepted != null;
          const bHas = b.latest_accepted != null;
          if (aHas !== bHas) return aHas ? -1 : 1;
          if (a.latest_accepted != null && b.latest_accepted != null) {
            const diff = (a.latest_accepted - b.latest_accepted) * mul;
            if (diff !== 0) return diff;
          }
          return a.acronym.localeCompare(b.acronym);
        }
        case "acronym":
          return a.acronym.localeCompare(b.acronym) * mul;
        case "title":
          return a.title.localeCompare(b.title) * mul;
      }
    });
    return list;
  }, [venues, search, cats, ranks, sort, dir]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const start = (safePage - 1) * PAGE_SIZE;
  const pageRows = filtered.slice(start, start + PAGE_SIZE);

  // sync URL whenever state changes (after initial hydration)
  useEffect(() => {
    if (hydrated) writeUrl(search, cats, ranks, sort, dir, safePage);
  }, [search, cats, ranks, sort, dir, safePage, hydrated]);

  const visibleCategories = useMemo(() => {
    if (showAllCats) return ALL_CATEGORIES;
    return ALL_CATEGORIES.filter(
      (cat) => PRIMARY_CATEGORIES.includes(cat) || cats.includes(cat)
    );
  }, [showAllCats, cats]);

  const hiddenCategoriesCount = ALL_CATEGORIES.length - visibleCategories.length;

  const toggle = (arr: string[], v: string, set: (a: string[]) => void) => {
    set(arr.includes(v) ? arr.filter((x) => x !== v) : [...arr, v]);
    setPage(1);
  };

  const setSortKey = (k: SortKey) => {
    if (k === sort) setDir(dir === "asc" ? "desc" : "asc");
    else {
      setSort(k);
      setDir("asc");
    }
    setPage(1);
  };
  const arrow = (k: SortKey) => (sort === k ? (dir === "asc" ? " ▲" : " ▼") : "");
  const ariaSort = (k: SortKey) =>
    sort === k ? (dir === "asc" ? "ascending" : "descending") : "none";

  const pageWindow = (() => {
    const w: number[] = [];
    const lo = Math.max(1, safePage - 2);
    const hi = Math.min(totalPages, safePage + 2);
    for (let i = lo; i <= hi; i++) w.push(i);
    return w;
  })();

  const exportCsv = () => {
    const headers = ["Rank", "Acronym", "Title", "Categories", "Acceptance Rate (%)", "Accepted Papers"];
    const rows = filtered.map((c) => [
      `"${c.rank.replace(/"/g, '""')}"`,
      `"${c.acronym.replace(/"/g, '""')}"`,
      `"${c.title.replace(/"/g, '""')}"`,
      `"${c.categories.join("; ").replace(/"/g, '""')}"`,
      c.latest_rate != null ? c.latest_rate.toFixed(1) : "",
      c.latest_accepted != null ? c.latest_accepted : "",
    ]);
    const csvText = [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
    const blob = new Blob([csvText], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `conferences_filtered_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  return (
    <div>
      <div className="space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative w-full sm:w-72">
            <input
              type="search"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              placeholder="Filter by name or acronym…"
              className="w-full rounded-lg border border-border bg-surface px-3 py-2 pr-8 text-sm
                         text-foreground placeholder:text-muted
                         focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
            />
            {search && (
              <button
                type="button"
                onClick={() => {
                  setSearch("");
                  setPage(1);
                }}
                aria-label="Clear search"
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted hover:text-foreground text-sm font-bold"
              >
                ×
              </button>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-1">
            <span className="text-xs font-semibold text-muted mr-1">Rank:</span>
            {RANKS.map((r) => (
              <button
                key={r.value}
                onClick={() => toggle(ranks, r.value, setRanks)}
                className={`rounded-full px-3 py-1.5 text-xs font-semibold transition ${
                  ranks.includes(r.value)
                    ? "bg-accent text-accent-contrast shadow-xs"
                    : "border border-border bg-surface text-foreground/80 hover:border-stone-400 hover:text-foreground dark:hover:border-stone-600"
                }`}
              >
                {r.label}
              </button>
            ))}
            {(ranks.length > 0 || cats.length > 0 || search) && (
              <button
                onClick={() => {
                  setRanks([]);
                  setCats([]);
                  setSearch("");
                }}
                className="rounded-full px-3 py-1.5 text-xs font-medium text-muted
                           underline-offset-2 hover:underline"
              >
                Clear filters
              </button>
            )}
          </div>
          <div className="ml-auto flex items-center gap-3">
            <button
              onClick={exportCsv}
              title="Export currently filtered list as CSV"
              className="rounded-lg border border-border bg-surface px-3 py-1.5 text-xs font-medium text-foreground/80
                         hover:bg-stone-100 dark:hover:bg-stone-800 transition"
            >
              Export CSV
            </button>
            <span className="text-sm text-muted">
              {filtered.length.toLocaleString()} venue{filtered.length === 1 ? "" : "s"}
            </span>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-xs font-semibold text-muted mr-1">Topic:</span>
          {visibleCategories.map((cat) => (
            <button
              key={cat}
              onClick={() => toggle(cats, cat as string, setCats)}
              className={`rounded-full px-3 py-1 text-xs font-medium transition ${
                cats.includes(cat)
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
              {showAllCats ? "Show fewer ▴" : `+ ${hiddenCategoriesCount} more ▾`}
            </button>
          )}
        </div>
      </div>

      <div className="mt-4 overflow-x-auto rounded-xl border border-border shadow-xs">
        <table className="w-full min-w-[720px] text-sm">
          <thead>
            <tr className="border-b border-border bg-stone-100/70 text-left text-xs
                           uppercase tracking-wide text-muted
                           dark:bg-stone-900/80">
              {onCompare && (
                <th className="sticky left-0 z-20 w-10 bg-surface px-3 py-3 text-center">
                  <span className="sr-only">Compare</span>
                </th>
              )}
              <th
                className={`sticky z-20 bg-surface px-4 py-3 font-semibold ${
                  onCompare ? "left-10" : "left-0"
                }`}
                aria-sort={ariaSort("rank")}
              >
                <button type="button" onClick={() => setSortKey("rank")} className="uppercase tracking-wide">
                  Rank{arrow("rank")}
                </button>
              </th>
              <th
                className={`sticky z-20 bg-surface border-r border-border/80 px-4 py-3 font-semibold shadow-[2px_0_4px_-2px_rgba(0,0,0,0.06)] ${
                  onCompare ? "left-[92px]" : "left-[52px]"
                }`}
                aria-sort={ariaSort("acronym")}
              >
                <button type="button" onClick={() => setSortKey("acronym")} className="uppercase tracking-wide">
                  Acronym{arrow("acronym")}
                </button>
              </th>
              <th className="px-4 py-3 font-semibold" aria-sort={ariaSort("title")}>
                <button type="button" onClick={() => setSortKey("title")} className="uppercase tracking-wide">
                  Title{arrow("title")}
                </button>
              </th>
              <th className="px-4 py-3 font-semibold" aria-sort={ariaSort("rate")}>
                <button type="button" onClick={() => setSortKey("rate")} className="uppercase tracking-wide">
                  Accept. rate{arrow("rate")}
                </button>
              </th>
              <th className="px-4 py-3 font-semibold" aria-sort={ariaSort("accepted")}>
                <button type="button" onClick={() => setSortKey("accepted")} className="uppercase tracking-wide">
                  Papers (last){arrow("accepted")}
                </button>
              </th>
            </tr>
          </thead>
          <tbody>
            {pageRows.map((c) => {
              const isSelected = selectedForCompare.includes(c.id);
              const rowBg = isSelected
                ? "bg-accent-soft/40 dark:bg-accent-soft/20"
                : "bg-surface group-hover:bg-stone-100/70 dark:bg-surface dark:group-hover:bg-stone-900/70";
              return (
                <tr
                  key={c.id}
                  className={`group border-b border-border/60 last:border-0 hover:bg-stone-100/70
                             dark:hover:bg-stone-900/70 ${
                               isSelected ? "bg-accent-soft/40 dark:bg-accent-soft/20" : ""
                             }`}
                >
                  {onCompare && (
                    <td className={`sticky left-0 z-10 px-3 py-2.5 text-center transition ${rowBg}`}>
                      <input
                        type="checkbox"
                        aria-label={`Select ${c.acronym} for comparison`}
                        checked={isSelected}
                        onChange={() => onCompare(c.id)}
                        className="size-4 rounded border-border text-accent focus:ring-accent dark:border-stone-700 dark:bg-stone-800"
                      />
                    </td>
                  )}
                  <td className={`sticky z-10 px-4 py-2.5 transition ${onCompare ? "left-10" : "left-0"} ${rowBg}`}>
                    <RankBadge rank={c.rank} />
                  </td>
                  <td
                    className={`sticky z-10 border-r border-border/80 px-4 py-2.5 font-bold text-foreground shadow-[2px_0_4px_-2px_rgba(0,0,0,0.06)] transition ${
                      onCompare ? "left-[92px]" : "left-[52px]"
                    } ${rowBg}`}
                  >
                    <Link href={`/conference/${c.id}`} className="hover:underline">
                      {c.acronym || "—"}
                    </Link>
                  </td>
                  <td className="max-w-[420px] truncate px-4 py-2.5 text-foreground/90">
                    <Link href={`/conference/${c.id}`} className="hover:underline">
                      {c.title}
                    </Link>
                  </td>
                  <td className="px-4 py-2.5 tabular-nums">
                    {c.latest_rate != null ? (
                      <span className="font-semibold text-foreground">
                        {c.latest_rate.toFixed(1)}%
                      </span>
                    ) : (
                      <span className="text-xs text-muted">no data</span>
                    )}
                  </td>
                  <td className="px-4 py-2.5 tabular-nums text-foreground/80">
                    {c.latest_accepted != null ? c.latest_accepted.toLocaleString() : "—"}
                  </td>
                </tr>
              );
            })}
            {pageRows.length === 0 && (
              <tr>
                <td colSpan={onCompare ? 6 : 5} className="px-4 py-10 text-center text-muted">
                  No venues match your filters.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <nav className="mt-4 flex flex-wrap items-center justify-center gap-1.5 text-sm" aria-label="Pagination">
          <button
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={safePage === 1}
            className="rounded-md border border-border bg-surface px-3 py-1.5 text-foreground/80
                       enabled:hover:bg-stone-100 disabled:opacity-40
                       dark:enabled:hover:bg-stone-800 transition"
          >
            ← Prev
          </button>
          {pageWindow[0] > 1 && (
            <>
              <button onClick={() => setPage(1)} className="rounded-md px-3 py-1.5 text-foreground/80 hover:bg-stone-100 dark:hover:bg-stone-800 transition">1</button>
              {pageWindow[0] > 2 && <span className="px-1 text-muted">…</span>}
            </>
          )}
          {pageWindow.map((p) => (
            <button
              key={p}
              onClick={() => setPage(p)}
              className={`rounded-md px-3 py-1.5 font-semibold transition ${
                p === safePage
                  ? "bg-accent text-accent-contrast shadow-xs"
                  : "text-foreground/80 hover:bg-stone-100 dark:hover:bg-stone-800"
              }`}
            >
              {p}
            </button>
          ))}
          {pageWindow[pageWindow.length - 1] < totalPages && (
            <>
              {pageWindow[pageWindow.length - 1] < totalPages - 1 && <span className="px-1 text-muted">…</span>}
              <button onClick={() => setPage(totalPages)} className="rounded-md px-3 py-1.5 text-foreground/80 hover:bg-stone-100 dark:hover:bg-stone-800 transition">{totalPages}</button>
            </>
          )}
          <button
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={safePage === totalPages}
            className="rounded-md border border-border bg-surface px-3 py-1.5 text-foreground/80
                       enabled:hover:bg-stone-100 disabled:opacity-40
                       dark:enabled:hover:bg-stone-800 transition"
          >
            Next →
          </button>
          <span className="ml-2 text-xs text-muted">
            {start + 1}–{Math.min(start + PAGE_SIZE, filtered.length)} of {filtered.length.toLocaleString()}
          </span>
        </nav>
      )}
    </div>
  );
}
