import { Suspense } from "react";
import Link from "next/link";
import SiteHeader from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";
import RankLegend from "@/components/RankLegend";
import HomeClient from "@/components/HomeClient";
import { getConferences } from "@/lib/data";
import { latestStat } from "@/lib/stats";
import { rankWeight } from "@/lib/ranks";
import type { Conference } from "@/lib/types";

function buildDirectory(c: Conference[]) {
  return c.map((r) => {
    const { rate, accepted } = latestStat(r);
    return {
      id: r.id,
      acronym: r.acronym,
      title: r.title,
      rank: r.rank,
      categories: r.categories,
      has_stats: Boolean(r.stats),
      latest_rate: rate === null ? null : Math.round(rate * 100) / 100,
      latest_accepted: accepted,
    };
  });
}

export interface LandscapePoint {
  id: string;
  acronym: string;
  title: string;
  rank: string;
  rate: number;
  accepted?: number;
  year?: number;
  categories: string[];
}

function buildLandscapePoints(venues: Conference[]): LandscapePoint[] {
  const points: LandscapePoint[] = [];
  for (const c of venues) {
    if (!c.stats || !c.stats.length) continue;
    const { rate, accepted, year } = latestStat(c);
    if (rate === null) continue;
    points.push({
      id: c.id,
      acronym: c.acronym,
      title: c.title,
      rank: c.rank,
      rate: Math.round(rate * 10) / 10,
      accepted: accepted ?? undefined,
      year: year ?? undefined,
      categories: c.categories ?? [],
    });
  }
  return points;
}

function getRisingVenues(venues: Conference[]) {
  const rising = [];
  for (const c of venues) {
    const hist = [...(c.rank_history ?? [])]
      .filter((h) => h.year)
      .sort((a, b) => (a.year ?? 0) - (b.year ?? 0));
    if (hist.length < 2) continue;
    const curr = hist[hist.length - 1];
    const prev = hist[hist.length - 2];
    const currW = rankWeight(curr.rank);
    const prevW = rankWeight(prev.rank);
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
  const landscapePoints = buildLandscapePoints(venues);
  const ranked = venues.filter((v) => ["A*", "A", "B", "C"].includes(v.rank)).length;
  const withStats = venues.filter((v) => v.stats && v.stats.length > 0).length;
  const risingVenues = getRisingVenues(venues);
  const totalAStar = venues.filter((v) => v.rank === "A*").length;

  return (
    <div className="min-h-screen bg-background">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "WebSite",
            name: "ConferenceRank",
            description:
              "Computer Science conference rankings (CORE/ICORE), acceptance rate trends, upcoming submission deadlines (AoE), and venue suggester.",
            potentialAction: {
              "@type": "SearchAction",
              target: "/?q={search_term_string}",
              "query-input": "required name=search_term_string",
            },
          }),
        }}
      />
      <SiteHeader />
      <main className="mx-auto max-w-6xl px-4 py-8">
        <div className="mb-6">
          <h1 className="text-2xl font-black tracking-tight text-foreground">
            Find the right venue for your research
          </h1>
          <p className="mt-1 text-sm text-muted">
            ICORE/CORE rankings, acceptance-rate trends, topics and publishing
            institutions for {venues.length.toLocaleString()} computer-science
            venues — {ranked.toLocaleString()} CORE-ranked,{" "}
            {withStats.toLocaleString()} with acceptance statistics.{" "}
            <Link
              href="/suggest/"
              className="font-semibold text-accent hover:underline inline-flex items-center gap-1"
            >
              <span>Have an abstract? Try the Venue Suggester →</span>
            </Link>
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
                    className="inline-flex items-center gap-1 rounded-md bg-surface px-2 py-1 font-semibold text-foreground shadow-xs hover:underline"
                  >
                    <span>{v.acronym}</span>
                    <span className="text-[10px] text-muted">
                      ({v.fromRank} → {v.toRank})
                    </span>
                  </Link>
                ))}
              </div>
            </div>
          )}
        </div>
        <RankLegend />
        <Suspense fallback={<div className="py-12 text-center text-sm text-muted">Loading ConferenceRank...</div>}>
          <HomeClient
            venues={venues}
            entries={entries}
            landscapePoints={landscapePoints}
            totalAStar={totalAStar}
          />
        </Suspense>
        <SiteFooter />
      </main>
    </div>
  );
}
