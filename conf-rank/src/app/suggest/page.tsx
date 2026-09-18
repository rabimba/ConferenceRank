import type { Metadata } from "next";
import Link from "next/link";
import SiteHeader from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";
import SuggestClient from "@/components/SuggestClient";
import { getConferences } from "@/lib/data";
import { latestStat } from "@/lib/stats";
import type { SuggesterVenue } from "@/lib/suggest";

export const metadata: Metadata = {
  title: "Venue Suggester — Find Target Conferences for Your Paper",
  description:
    "Find the right computer science conference for your paper abstract using CORE rankings, acceptance selectivity, and topic matching.",
  alternates: { canonical: "/suggest/" },
  openGraph: {
    title: "Venue Suggester — Find Target Conferences for Your Paper",
    description:
      "Paste your paper title and abstract to get ranked CS conference suggestions tailored by CORE prestige tiers, acceptance rates, and topics.",
    images: [
      {
        url: `${process.env.NEXT_PUBLIC_BASE_PATH ?? ""}/og-image.png`,
        width: 1200,
        height: 630,
        alt: "ConferenceRank Venue Suggester",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Venue Suggester — Find Target Conferences for Your Paper | ConferenceRank",
    description:
      "Paste your paper title and abstract to get ranked CS conference suggestions tailored by CORE prestige tiers, acceptance rates, and topics.",
    images: [`${process.env.NEXT_PUBLIC_BASE_PATH ?? ""}/og-image.png`],
  },
};

export default function SuggestPage() {
  const venues = getConferences();

  // Build a slim payload for the client component (avoiding full 900KB serialization)
  const slimVenues: SuggesterVenue[] = venues.map((c) => {
    const { rate, accepted } = latestStat(c);
    return {
      id: c.id,
      acronym: c.acronym,
      title: c.title,
      rank: c.rank,
      categories: c.categories,
      latest_rate: rate === null ? null : Math.round(rate * 100) / 100,
      latest_accepted: accepted,
      has_stats: Boolean(c.stats && c.stats.length > 0),
      topics: c.openalex?.topics?.slice(0, 8).map((t) => t.name),
    };
  });

  return (
    <div className="min-h-screen bg-background">
      <SiteHeader />
      <main className="mx-auto max-w-6xl px-4 py-8">
        {/* Navigation Breadcrumb */}
        <div className="mb-4">
          <Link
            href="/"
            className="inline-flex items-center gap-1 text-xs font-semibold text-muted hover:text-foreground transition"
          >
            ← Back to Conference Directory
          </Link>
        </div>

        {/* Page Header */}
        <div className="mb-8">
          <div className="inline-flex items-center gap-2 rounded-full bg-accent-soft px-3 py-1 text-xs font-bold text-accent">
            <span>✨ Keyword &amp; Similarity Matching</span>
            <span>•</span>
            <span>{slimVenues.length} Venues Indexed</span>
          </div>

          <h1 className="mt-3 text-3xl font-black tracking-tight text-foreground sm:text-4xl">
            Venue Suggester
          </h1>
          <p className="mt-2 max-w-2xl text-sm text-muted">
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
