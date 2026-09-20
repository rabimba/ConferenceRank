"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import DualRankBadge from "./DualRankBadge";
import type { Journal } from "@/lib/journal-types";

export interface JournalDirectoryProps {
  journals: Journal[];
  categories: string[];
}

const PAGE_SIZE = 50;

const CORE_RANKS = [
  { value: "A*", label: "A*" },
  { value: "A", label: "A" },
  { value: "B", label: "B" },
  { value: "C", label: "C" },
  { value: "Unranked", label: "Unranked" },
] as const;

const SJR_QUARTILES = [
  { value: "Q1", label: "Q1" },
  { value: "Q2", label: "Q2" },
  { value: "Q3", label: "Q3" },
  { value: "Q4", label: "Q4" },
] as const;

type SortKey = "sjr" | "h_index" | "title" | "rank";

function readUrl(): {
  q: string;
  cat: string;
  ranks: string[];
  quartiles: string[];
  sort: SortKey;
  dir: "asc" | "desc";
  page: number;
} {
  if (typeof window === "undefined") {
    return {
      q: "",
      cat: "",
      ranks: [],
      quartiles: [],
      sort: "sjr",
      dir: "desc",
      page: 1,
    };
  }
  const p = new URLSearchParams(window.location.search);
  const rawSort = p.get("sort");
  const validSort: SortKey =
    rawSort === "h_index" || rawSort === "title" || rawSort === "rank" || rawSort === "sjr"
      ? rawSort
      : "sjr";
  const rawDir = p.get("dir");
  const validDir: "asc" | "desc" = rawDir === "asc" ? "asc" : "desc";
  return {
    q: p.get("q") ?? "",
    cat: p.get("cat") ?? "",
    ranks: (p.get("ranks") ?? "").split(",").filter(Boolean),
    quartiles: (p.get("quartiles") ?? "").split(",").filter(Boolean),
    sort: validSort,
    dir: validDir,
    page: Math.max(1, parseInt(p.get("page") ?? "1", 10) || 1),
  };
}

function writeUrl(
  q: string,
  cat: string,
  ranks: string[],
  quartiles: string[],
  sort: SortKey,
  dir: "asc" | "desc",
  page: number
) {
  if (typeof window === "undefined") return;
  const p = new URLSearchParams();
  if (q) p.set("q", q);
  if (cat) p.set("cat", cat);
  if (ranks.length) p.set("ranks", ranks.join(","));
  if (quartiles.length) p.set("quartiles", quartiles.join(","));
  if (sort !== "sjr") p.set("sort", sort);
  if (dir !== "desc") p.set("dir", dir);
  if (page > 1) p.set("page", String(page));
  const qs = p.toString();
  window.history.replaceState(null, "", qs ? `?${qs}` : window.location.pathname);
}

function getRankWeight(r: string | null): number {
  switch (r) {
    case "A*":
      return 4;
    case "A":
      return 3;
    case "B":
      return 2;
    case "C":
      return 1;
    default:
      return 0;
  }
}

function getQuartile(j: Journal): "Q1" | "Q2" | "Q3" | "Q4" | null {
  if (j.sjr?.latest_quartile) return j.sjr.latest_quartile;
  const score = j.sjr?.latest_score;
  if (score == null) return null;
  // Fallback quartile estimate based on CS SJR distribution (Q1 >= 1.0, Q2 >= 0.5, Q3 >= 0.25)
  if (score >= 1.0) return "Q1";
  if (score >= 0.5) return "Q2";
  if (score >= 0.25) return "Q3";
  return "Q4";
}

export default function JournalDirectory({ journals, categories }: JournalDirectoryProps) {
  const [search, setSearch] = useState("");
  const [selectedCat, setSelectedCat] = useState("");
  const [selectedRanks, setSelectedRanks] = useState<string[]>([]);
  const [selectedQuartiles, setSelectedQuartiles] = useState<string[]>([]);
  const [sort, setSort] = useState<SortKey>("sjr");
  const [dir, setDir] = useState<"asc" | "desc">("desc");
  const [page, setPage] = useState(1);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    const u = readUrl();
    setSearch(u.q);
    setSelectedCat(u.cat);
    setSelectedRanks(u.ranks);
    setSelectedQuartiles(u.quartiles);
    setSort(u.sort);
    setDir(u.dir);
    setPage(u.page);
    setHydrated(true);
  }, []);

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    let list = journals.filter((j) => {
      if (q) {
        const titleMatch = j.title.toLowerCase().includes(q);
        const acronymMatch = j.acronym ? j.acronym.toLowerCase().includes(q) : false;
        const issnMatch = j.issn?.some((i) => i.toLowerCase().includes(q)) ?? false;
        const publisherMatch = j.publisher ? j.publisher.toLowerCase().includes(q) : false;
        if (!titleMatch && !acronymMatch && !issnMatch && !publisherMatch) return false;
      }

      if (selectedCat && !j.categories.includes(selectedCat)) {
        return false;
      }

      if (selectedRanks.length > 0) {
        const matchesRank = selectedRanks.some((r) => {
          if (r === "Unranked") {
            return !j.core_rank || !["A*", "A", "B", "C"].includes(j.core_rank);
          }
          return j.core_rank === r;
        });
        if (!matchesRank) return false;
      }

      if (selectedQuartiles.length > 0) {
        const qVal = getQuartile(j);
        if (!qVal || !selectedQuartiles.includes(qVal)) {
          return false;
        }
      }

      return true;
    });

    const mul = dir === "asc" ? 1 : -1;
    list = [...list].sort((a, b) => {
      switch (sort) {
        case "sjr": {
          const aVal = a.sjr?.latest_score;
          const bVal = b.sjr?.latest_score;
          if (aVal == null && bVal == null) return a.title.localeCompare(b.title);
          if (aVal == null) return 1;
          if (bVal == null) return -1;
          const diff = (aVal - bVal) * mul;
          return diff !== 0 ? diff : a.title.localeCompare(b.title);
        }
        case "h_index": {
          const aVal = a.sjr?.latest_h_index;
          const bVal = b.sjr?.latest_h_index;
          if (aVal == null && bVal == null) return a.title.localeCompare(b.title);
          if (aVal == null) return 1;
          if (bVal == null) return -1;
          const diff = (aVal - bVal) * mul;
          return diff !== 0 ? diff : a.title.localeCompare(b.title);
        }
        case "rank": {
          const aW = getRankWeight(a.core_rank);
          const bW = getRankWeight(b.core_rank);
          const diff = (aW - bW) * mul;
          return diff !== 0 ? diff : a.title.localeCompare(b.title);
        }
        case "title":
          return a.title.localeCompare(b.title) * mul;
      }
    });

    return list;
  }, [journals, search, selectedCat, selectedRanks, selectedQuartiles, sort, dir]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const start = (safePage - 1) * PAGE_SIZE;
  const pageRows = filtered.slice(start, start + PAGE_SIZE);

  useEffect(() => {
    if (hydrated) {
      writeUrl(search, selectedCat, selectedRanks, selectedQuartiles, sort, dir, safePage);
    }
  }, [search, selectedCat, selectedRanks, selectedQuartiles, sort, dir, safePage, hydrated]);

  const toggleFilter = (arr: string[], item: string, setter: (val: string[]) => void) => {
    setter(arr.includes(item) ? arr.filter((x) => x !== item) : [...arr, item]);
    setPage(1);
  };

  const handleSortChange = (newSort: SortKey) => {
    if (newSort === sort) {
      setDir(dir === "asc" ? "desc" : "asc");
    } else {
      setSort(newSort);
      setDir(newSort === "title" ? "asc" : "desc");
    }
    setPage(1);
  };

  const arrow = (k: SortKey) => (sort === k ? (dir === "asc" ? " ▲" : " ▼") : "");

  const pageWindow = (() => {
    const w: number[] = [];
    const lo = Math.max(1, safePage - 2);
    const hi = Math.min(totalPages, safePage + 2);
    for (let i = lo; i <= hi; i++) w.push(i);
    return w;
  })();

  return (
    <div>
      {/* Search & Filter Toolbar */}
      <div className="rounded-xl border border-border bg-surface p-4 shadow-xs space-y-4">
        <div className="flex flex-col gap-3 md:flex-row md:items-center">
          {/* Search */}
          <div className="relative flex-1">
            <input
              type="search"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              placeholder="Search journals by title, acronym, or ISSN…"
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

          {/* Category Dropdown */}
          <div className="w-full md:w-64">
            <select
              value={selectedCat}
              onChange={(e) => {
                setSelectedCat(e.target.value);
                setPage(1);
              }}
              className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-foreground focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
            >
              <option value="">All Categories ({categories.length})</option>
              {categories.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>

          <div className="text-right text-xs font-semibold text-muted whitespace-nowrap">
            {filtered.length.toLocaleString()} journal{filtered.length === 1 ? "" : "s"}
          </div>
        </div>

        {/* Filters Row: CORE Rank & SJR Quartile */}
        <div className="flex flex-wrap items-center gap-4 pt-1 border-t border-border/60">
          {/* CORE Ranks */}
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-xs font-semibold text-muted mr-1">CORE Rank:</span>
            {CORE_RANKS.map((r) => (
              <button
                key={r.value}
                type="button"
                onClick={() => toggleFilter(selectedRanks, r.value, setSelectedRanks)}
                className={`rounded-full px-3 py-1 text-xs font-semibold transition ${
                  selectedRanks.includes(r.value)
                    ? "bg-accent text-accent-contrast shadow-xs"
                    : "border border-border bg-surface text-foreground/80 hover:border-stone-400 hover:text-foreground dark:hover:border-stone-600"
                }`}
              >
                {r.label}
              </button>
            ))}
          </div>

          {/* SJR Quartiles */}
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-xs font-semibold text-muted mr-1">SJR Quartile:</span>
            {SJR_QUARTILES.map((q) => (
              <button
                key={q.value}
                type="button"
                onClick={() => toggleFilter(selectedQuartiles, q.value, setSelectedQuartiles)}
                className={`rounded-full px-3 py-1 text-xs font-semibold transition ${
                  selectedQuartiles.includes(q.value)
                    ? "bg-purple-600 text-white shadow-xs"
                    : "border border-border bg-surface text-foreground/80 hover:border-stone-400 hover:text-foreground dark:hover:border-stone-600"
                }`}
              >
                {q.label}
              </button>
            ))}
          </div>

          {/* Clear Filters */}
          {(search || selectedCat || selectedRanks.length > 0 || selectedQuartiles.length > 0) && (
            <button
              type="button"
              onClick={() => {
                setSearch("");
                setSelectedCat("");
                setSelectedRanks([]);
                setSelectedQuartiles([]);
                setPage(1);
              }}
              className="text-xs font-medium text-muted underline-offset-2 hover:underline hover:text-foreground transition ml-auto"
            >
              Reset all filters
            </button>
          )}
        </div>
      </div>

      {/* Directory Table */}
      <div className="mt-6 overflow-x-auto rounded-xl border border-border bg-surface shadow-xs">
        <table className="w-full min-w-[700px] text-sm text-left">
          <thead>
            <tr className="border-b border-border bg-stone-100/70 text-xs uppercase tracking-wide text-muted dark:bg-stone-900/80">
              <th className="px-4 py-3 font-semibold">
                <button
                  type="button"
                  onClick={() => handleSortChange("rank")}
                  className="uppercase tracking-wide flex items-center gap-1"
                >
                  Rank{arrow("rank")}
                </button>
              </th>
              <th className="px-4 py-3 font-semibold">
                <button
                  type="button"
                  onClick={() => handleSortChange("title")}
                  className="uppercase tracking-wide flex items-center gap-1"
                >
                  Journal Title{arrow("title")}
                </button>
              </th>
              <th className="px-4 py-3 font-semibold">Category</th>
              <th className="px-4 py-3 font-semibold text-right">
                <button
                  type="button"
                  onClick={() => handleSortChange("sjr")}
                  className="uppercase tracking-wide flex items-center gap-1 ml-auto"
                >
                  SJR Score{arrow("sjr")}
                </button>
              </th>
              <th className="px-4 py-3 font-semibold text-right">
                <button
                  type="button"
                  onClick={() => handleSortChange("h_index")}
                  className="uppercase tracking-wide flex items-center gap-1 ml-auto"
                >
                  H-Index{arrow("h_index")}
                </button>
              </th>
            </tr>
          </thead>
          <tbody>
            {pageRows.map((j) => {
              const quartile = getQuartile(j);
              const coreRank =
                j.core_rank && ["A*", "A", "B", "C"].includes(j.core_rank)
                  ? j.core_rank
                  : null;

              return (
                <tr
                  key={j.id}
                  className="border-b border-border/60 last:border-0 hover:bg-stone-100/60 dark:hover:bg-stone-900/60 transition"
                >
                  <td className="px-4 py-3 whitespace-nowrap">
                    <DualRankBadge coreRank={coreRank} sjrQuartile={quartile} size="sm" />
                  </td>
                  <td className="px-4 py-3">
                    <div>
                      <Link
                        href={`/journal/${j.id}/`}
                        className="font-bold text-foreground hover:text-accent hover:underline line-clamp-1"
                      >
                        {j.title}
                      </Link>
                      <div className="flex flex-wrap items-center gap-2 mt-0.5 text-xs text-muted">
                        {j.acronym && <span className="font-semibold text-foreground/80">{j.acronym}</span>}
                        {j.issn && j.issn.length > 0 && (
                          <span>ISSN: {j.issn.join(", ")}</span>
                        )}
                        {j.is_oa && (
                          <span className="rounded bg-emerald-500/10 px-1 py-0.2 text-[10px] font-bold text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                            OA
                          </span>
                        )}
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-xs text-muted">
                    <div className="line-clamp-1 max-w-[200px]">
                      {j.categories.join(", ") || "General CS"}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-right font-mono text-sm tabular-nums">
                    {j.sjr?.latest_score != null ? (
                      <span className="font-semibold text-foreground">
                        {j.sjr.latest_score.toFixed(3)}
                      </span>
                    ) : (
                      <span className="text-xs text-muted">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right font-mono text-sm tabular-nums text-foreground/80">
                    {j.sjr?.latest_h_index != null ? j.sjr.latest_h_index : "—"}
                  </td>
                </tr>
              );
            })}
            {pageRows.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-12 text-center text-muted">
                  No journals match your selected filters.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <nav
          className="mt-6 flex flex-wrap items-center justify-center gap-1.5 text-sm"
          aria-label="Pagination"
        >
          <button
            type="button"
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
              <button
                type="button"
                onClick={() => setPage(1)}
                className="rounded-md px-3 py-1.5 text-foreground/80 hover:bg-stone-100 dark:hover:bg-stone-800 transition"
              >
                1
              </button>
              {pageWindow[0] > 2 && <span className="px-1 text-muted">…</span>}
            </>
          )}
          {pageWindow.map((p) => (
            <button
              type="button"
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
              {pageWindow[pageWindow.length - 1] < totalPages - 1 && (
                <span className="px-1 text-muted">…</span>
              )}
              <button
                type="button"
                onClick={() => setPage(totalPages)}
                className="rounded-md px-3 py-1.5 text-foreground/80 hover:bg-stone-100 dark:hover:bg-stone-800 transition"
              >
                {totalPages}
              </button>
            </>
          )}
          <button
            type="button"
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={safePage === totalPages}
            className="rounded-md border border-border bg-surface px-3 py-1.5 text-foreground/80
                       enabled:hover:bg-stone-100 disabled:opacity-40
                       dark:enabled:hover:bg-stone-800 transition"
          >
            Next →
          </button>
          <span className="ml-2 text-xs text-muted">
            {start + 1}–{Math.min(start + PAGE_SIZE, filtered.length)} of{" "}
            {filtered.length.toLocaleString()}
          </span>
        </nav>
      )}
    </div>
  );
}
