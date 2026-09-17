import Link from "next/link";
import SiteHeader from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";
import RankLegend from "@/components/RankLegend";
import HomeClient from "@/components/HomeClient";
import { getConferences } from "@/lib/data";
import type { Conference } from "@/lib/types";
import type { LandscapePoint } from "@/components/Charts";

function buildDirectory(c: Conference[]) {
  return c.map((r) => {
    let latest_rate: number | null = null;
    let latest_accepted: number | null = null;
    if (r.stats && r.stats.length) {
      const sorted = [...r.stats].sort((a, b) => b.year - a.year);
      for (const s of sorted) {
        if (s.rate && s.rate > 0 && s.rate < 60) {
          latest_rate = Math.round(s.rate * 100) / 100;
          break;
        }
      }
      latest_accepted = sorted[0].accepted ?? sorted[0].accepted_short ?? null;
    }
    return {
      id: r.id,
      acronym: r.acronym,
      title: r.title,
      rank: r.rank,
      categories: r.categories,
      has_stats: Boolean(r.stats),
      latest_rate,
      latest_accepted,
    };
  });
}

function buildScatterPoints(venues: Conference[]): LandscapePoint[] {
  const points: LandscapePoint[] = [];
  for (const c of venues) {
    if (!c.stats) continue;
    for (const s of c.stats) {
      if (s.rate && s.rate > 0 && s.rate < 60) {
        points.push({
          id: c.id,
          acronym: c.acronym,
          rank: c.rank,
          rate: Math.round(s.rate * 10) / 10,
          accepted: s.accepted ?? s.total,
        });
        break;
      }
    }
  }
  return points;
}

const RANK_WEIGHTS: Record<string, number> = {
  "A*": 4,
  A: 3,
  B: 2,
  "Australasian B": 2,
  C: 1,
  "Australasian C": 1,
};

function getRisingVenues(venues: Conference[]) {
  const rising = [];
  for (const c of venues) {
    const hist = [...(c.rank_history ?? [])]
      .filter((h) => h.year)
      .sort((a, b) => (a.year ?? 0) - (b.year ?? 0));
    if (hist.length < 2) continue;
    const curr = hist[hist.length - 1];
    const prev = hist[hist.length - 2];
    const currW = RANK_WEIGHTS[curr.rank] ?? 0;
    const prevW = RANK_WEIGHTS[prev.rank] ?? 0;
    if (currW > prevW && prevW > 0) {
      rising.push({
        id: c.id,
        acronym: c.acronym,
        fromRank: prev.rank,
        toRank: curr.rank,
        year: curr.year,
      });
    }
  }
  return rising.slice(0, 8);
}

export default function Home() {
  const venues = getConferences();
  const entries = buildDirectory(venues);
  const scatterPoints = buildScatterPoints(venues);
  const ranked = venues.filter((v) => ["A*", "A", "B", "C"].includes(v.rank)).length;
  const withStats = venues.filter((v) => v.stats && v.stats.length > 0).length;
  const risingVenues = getRisingVenues(venues);

  return (
    <div className="min-h-screen bg-neutral-50 dark:bg-neutral-950">
      <SiteHeader />
      <main className="mx-auto max-w-6xl px-4 py-8">
        <div className="mb-6">
          <h1 className="text-2xl font-black tracking-tight text-neutral-900 dark:text-neutral-100">
            Find the right venue for your research
          </h1>
          <p className="mt-1 text-sm text-neutral-600 dark:text-neutral-400">
            ICORE/CORE rankings, acceptance-rate trends, topics and publishing
            institutions for {venues.length.toLocaleString()} computer-science
            venues — {ranked.toLocaleString()} CORE-ranked,{" "}
            {withStats.toLocaleString()} with acceptance statistics.
          </p>

          {risingVenues.length > 0 && (
            <div className="mt-4 flex flex-wrap items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50/60 p-3 text-xs dark:border-emerald-900/60 dark:bg-emerald-950/30">
              <span className="font-bold text-emerald-800 dark:text-emerald-300">
                🚀 Rising Venues (CORE upgrades):
              </span>
              <div className="flex flex-wrap items-center gap-2">
                {risingVenues.map((v) => (
                  <Link
                    key={v.id}
                    href={`/conference/${v.id}`}
                    className="inline-flex items-center gap-1 rounded-md bg-white px-2 py-1 font-semibold text-neutral-800 shadow-xs hover:underline dark:bg-neutral-900 dark:text-neutral-200"
                  >
                    <span>{v.acronym}</span>
                    <span className="text-[10px] text-neutral-400">
                      ({v.fromRank} → {v.toRank})
                    </span>
                  </Link>
                ))}
              </div>
            </div>
          )}
        </div>
        <RankLegend />
        <HomeClient
          venues={venues}
          entries={entries}
          scatterPoints={scatterPoints}
        />
        <SiteFooter />
      </main>
    </div>
  );
}
