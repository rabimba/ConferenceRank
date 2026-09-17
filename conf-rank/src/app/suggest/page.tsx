import type { Metadata } from "next";
import Link from "next/link";
import SiteHeader from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";
import SuggestClient from "@/components/SuggestClient";
import { getConferences } from "@/lib/data";
import type { SuggesterVenue } from "@/lib/suggest";

export const metadata: Metadata = {
  title: "Venue Suggester | ConferenceRank",
  description:
    "Find the right computer science conference for your paper abstract using CORE rankings, acceptance selectivity, and topic matching.",
};

export default function SuggestPage() {
  const venues = getConferences();

  // Build a slim payload for the client component (avoiding full 900KB serialization)
  const slimVenues: SuggesterVenue[] = venues.map((c) => {
    let latest_rate: number | null = null;
    let latest_accepted: number | null = null;

    if (c.stats && c.stats.length) {
      const sorted = [...c.stats].sort((a, b) => b.year - a.year);
      for (const s of sorted) {
        if (s.rate && s.rate > 0 && s.rate < 60) {
          latest_rate = Math.round(s.rate * 100) / 100;
          break;
        }
      }
      latest_accepted = sorted[0].accepted ?? sorted[0].accepted_short ?? null;
    }

    return {
      id: c.id,
      acronym: c.acronym,
      title: c.title,
      rank: c.rank,
      categories: c.categories,
      latest_rate,
      latest_accepted,
      has_stats: Boolean(c.stats && c.stats.length > 0),
    };
  });

  return (
    <div className="min-h-screen bg-neutral-50 dark:bg-neutral-950">
      <SiteHeader />
      <main className="mx-auto max-w-6xl px-4 py-8">
        {/* Navigation Breadcrumb */}
        <div className="mb-4">
          <Link
            href="/"
            className="inline-flex items-center gap-1 text-xs font-semibold text-neutral-500 hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-neutral-100 transition"
          >
            ← Back to Conference Directory
          </Link>
        </div>

        {/* Page Header */}
        <div className="mb-8">
          <div className="inline-flex items-center gap-2 rounded-full bg-blue-50 px-3 py-1 text-xs font-bold text-blue-700 dark:bg-blue-950/70 dark:text-blue-300">
            <span>✨ AI &amp; Lexical Matching</span>
            <span>•</span>
            <span>{slimVenues.length} Venues Indexed</span>
          </div>

          <h1 className="mt-3 text-3xl font-black tracking-tight text-neutral-900 dark:text-neutral-100 sm:text-4xl">
            Venue Suggester
          </h1>
          <p className="mt-2 max-w-2xl text-sm text-neutral-600 dark:text-neutral-400">
            Paste your draft abstract to find the best-fitting computer science conferences. We match vocabulary, methodologies, and topics across CORE prestige tiers (A* to C) with historical acceptance rate context.
          </p>
        </div>

        {/* Interactive Client Component */}
        <SuggestClient venues={slimVenues} />

        <SiteFooter />
      </main>
    </div>
  );
}
