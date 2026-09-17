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

type SortKey = "rank" | "rate" | "accepted" | "acronym" | "title";

function readUrl(): {
  q: string;
  cats: string[];
  ranks: string[];
  page: number;
} {
  if (typeof window === "undefined") return { q: "", cats: [], ranks: [], page: 1 };
  const p = new URLSearchParams(window.location.search);
  return {
    q: p.get("q") ?? "",
    cats: (p.get("cats") ?? "").split(",").filter(Boolean),
    ranks: (p.get("ranks") ?? "").split(",").filter(Boolean),
    page: Math.max(1, parseInt(p.get("page") ?? "1", 10) || 1),
  };
}

function writeUrl(q: string, cats: string[], ranks: string[], page: number) {
  if (typeof window === "undefined") return;
  const p = new URLSearchParams();
  if (q) p.set("q", q);
  if (cats.length) p.set("cats", cats.join(","));
  if (ranks.length) p.set("ranks", ranks.join(","));
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

  // hydrate filter state from the URL once on mount
  useEffect(() => {
    const u = readUrl();
    setSearch(u.q);
    setCats(u.cats);
    setRanks(u.ranks);
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
    if (hydrated) writeUrl(search, cats, ranks, safePage);
  }, [search, cats, ranks, safePage, hydrated]);

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
          <input
            type="search"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            placeholder="Filter by name or acronym…"
            className="w-64 rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm
                       text-neutral-900 placeholder:text-neutral-500
                       focus:border-neutral-900 focus:outline-none focus:ring-1 focus:ring-neutral-900
                       dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-100
                       dark:placeholder:text-neutral-400 dark:focus:border-neutral-400
                       dark:focus:ring-neutral-400"
          />
          <div className="flex flex-wrap gap-1">
            {RANKS.map((r) => (
              <button
                key={r.value}
                onClick={() => toggle(ranks, r.value, setRanks)}
                className={`rounded-full px-3 py-1.5 text-xs font-semibold transition ${
                  ranks.includes(r.value)
                    ? "bg-neutral-900 text-white dark:bg-white dark:text-neutral-900"
                    : "bg-neutral-100 text-neutral-700 hover:bg-neutral-200 dark:bg-neutral-800 dark:text-neutral-300 dark:hover:bg-neutral-700"
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
                className="rounded-full px-3 py-1.5 text-xs font-medium text-neutral-500
                           underline-offset-2 hover:underline dark:text-neutral-400"
              >
                Clear filters
              </button>
            )}
          </div>
          <div className="ml-auto flex items-center gap-3">
            <button
              onClick={exportCsv}
              title="Export currently filtered list as CSV"
              className="rounded-lg border border-neutral-300 px-3 py-1.5 text-xs font-medium text-neutral-700
                         hover:bg-neutral-100 dark:border-neutral-700 dark:text-neutral-300 dark:hover:bg-neutral-800"
            >
              Export CSV
            </button>
            <span className="text-sm text-neutral-500 dark:text-neutral-400">
              {filtered.length.toLocaleString()} venue{filtered.length === 1 ? "" : "s"}
            </span>
          </div>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {ALL_CATEGORIES.map((cat) => (
            <button
              key={cat}
              onClick={() => toggle(cats, cat as string, setCats)}
              className={`rounded-full px-3 py-1 text-xs font-medium transition ${
                cats.includes(cat)
                  ? "bg-blue-600 text-white"
                  : "bg-neutral-100 text-neutral-700 hover:bg-neutral-200 dark:bg-neutral-800 dark:text-neutral-300 dark:hover:bg-neutral-700"
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-4 overflow-x-auto rounded-xl border border-neutral-200
                      dark:border-neutral-800">
        <table className="w-full min-w-[720px] text-sm">
          <thead>
            <tr className="border-b border-neutral-200 bg-neutral-50 text-left text-xs
                           uppercase tracking-wide text-neutral-500
                           dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-400">
              {onCompare && (
                <th className="w-10 px-3 py-3 text-center">
                  <span className="sr-only">Compare</span>
                </th>
              )}
              <th className="px-4 py-3 font-semibold" aria-sort={ariaSort("rank")}>
                <button type="button" onClick={() => setSortKey("rank")} className="uppercase tracking-wide">
                  Rank{arrow("rank")}
                </button>
              </th>
              <th className="px-4 py-3 font-semibold" aria-sort={ariaSort("acronym")}>
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
            {pageRows.map((c) => (
              <tr
                key={c.id}
                className={`border-b border-neutral-100 last:border-0 hover:bg-neutral-50
                           dark:border-neutral-800/60 dark:hover:bg-neutral-900/60 ${
                             selectedForCompare.includes(c.id) ? "bg-blue-50/50 dark:bg-blue-950/20" : ""
                           }`}
              >
                {onCompare && (
                  <td className="px-3 py-2.5 text-center">
                    <input
                      type="checkbox"
                      aria-label={`Select ${c.acronym} for comparison`}
                      checked={selectedForCompare.includes(c.id)}
                      onChange={() => onCompare(c.id)}
                      className="size-4 rounded border-neutral-300 text-blue-600 focus:ring-blue-500 dark:border-neutral-700 dark:bg-neutral-800"
                    />
                  </td>
                )}
                <td className="px-4 py-2.5">
                  <RankBadge rank={c.rank} />
                </td>
                <td className="px-4 py-2.5 font-bold text-neutral-900 dark:text-neutral-100">
                  <Link href={`/conference/${c.id}`} className="hover:underline">
                    {c.acronym || "—"}
                  </Link>
                </td>
                <td className="max-w-[420px] truncate px-4 py-2.5 text-neutral-700 dark:text-neutral-300">
                  <Link href={`/conference/${c.id}`} className="hover:underline">
                    {c.title}
                  </Link>
                </td>
                <td className="px-4 py-2.5 tabular-nums">
                  {c.latest_rate != null ? (
                    <span className="font-semibold text-neutral-800 dark:text-neutral-200">
                      {c.latest_rate.toFixed(1)}%
                    </span>
                  ) : (
                    <span className="text-xs text-neutral-500 dark:text-neutral-500">no data</span>
                  )}
                </td>
                <td className="px-4 py-2.5 tabular-nums text-neutral-700 dark:text-neutral-300">
                  {c.latest_accepted != null ? c.latest_accepted.toLocaleString() : "—"}
                </td>
              </tr>
            ))}
            {pageRows.length === 0 && (
              <tr>
                <td colSpan={onCompare ? 6 : 5} className="px-4 py-10 text-center text-neutral-500 dark:text-neutral-400">
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
            className="rounded-md border border-neutral-300 px-3 py-1.5 text-neutral-700
                       enabled:hover:bg-neutral-100 disabled:opacity-40
                       dark:border-neutral-700 dark:text-neutral-300 dark:enabled:hover:bg-neutral-800"
          >
            ← Prev
          </button>
          {pageWindow[0] > 1 && (
            <>
              <button onClick={() => setPage(1)} className="rounded-md px-3 py-1.5 text-neutral-600 hover:bg-neutral-100 dark:text-neutral-400 dark:hover:bg-neutral-800">1</button>
              {pageWindow[0] > 2 && <span className="px-1 text-neutral-400 dark:text-neutral-600">…</span>}
            </>
          )}
          {pageWindow.map((p) => (
            <button
              key={p}
              onClick={() => setPage(p)}
              className={`rounded-md px-3 py-1.5 font-semibold ${
                p === safePage
                  ? "bg-neutral-900 text-white dark:bg-white dark:text-neutral-900"
                  : "text-neutral-600 hover:bg-neutral-100 dark:text-neutral-400 dark:hover:bg-neutral-800"
              }`}
            >
              {p}
            </button>
          ))}
          {pageWindow[pageWindow.length - 1] < totalPages && (
            <>
              {pageWindow[pageWindow.length - 1] < totalPages - 1 && <span className="px-1 text-neutral-400 dark:text-neutral-600">…</span>}
              <button onClick={() => setPage(totalPages)} className="rounded-md px-3 py-1.5 text-neutral-600 hover:bg-neutral-100 dark:text-neutral-400 dark:hover:bg-neutral-800">{totalPages}</button>
            </>
          )}
          <button
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={safePage === totalPages}
            className="rounded-md border border-neutral-300 px-3 py-1.5 text-neutral-700
                       enabled:hover:bg-neutral-100 disabled:opacity-40
                       dark:border-neutral-700 dark:text-neutral-300 dark:enabled:hover:bg-neutral-800"
          >
            Next →
          </button>
          <span className="ml-2 text-xs text-neutral-500 dark:text-neutral-400">
            {start + 1}–{Math.min(start + PAGE_SIZE, filtered.length)} of {filtered.length.toLocaleString()}
          </span>
        </nav>
      )}
    </div>
  );
}
