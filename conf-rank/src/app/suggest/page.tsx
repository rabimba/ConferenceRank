import type { Metadata } from "next";
import Link from "next/link";
import SiteHeader from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";
import SuggestClient from "@/components/SuggestClient";
import { getConferences } from "@/lib/data";
import { getJournals } from "@/lib/journal-data";
import { getJournalQuartile } from "@/lib/quartile";
import { latestStat } from "@/lib/stats";
import type { SuggesterVenue } from "@/lib/suggest";

const siteUrl =
  process.env.NEXT_PUBLIC_SITE_URL ??
  (process.env.GITHUB_ACTIONS === "true"
    ? `https://${(process.env.GITHUB_REPOSITORY ?? "rabimba/ConferenceRank").split("/")[0]}.github.io/${(process.env.GITHUB_REPOSITORY ?? "rabimba/ConferenceRank").split("/")[1]}`
    : "https://rabimba.github.io/ConferenceRank");
const ogImageUrl = `${siteUrl.replace(/\/$/, "")}/og-image.png`;

export const metadata: Metadata = {
  title: "Venue Suggester — Find Target Conferences & Journals for Your Paper",
  description:
    "Find the right computer science conference or journal for your paper abstract using CORE rankings, SJR quartiles, acceptance selectivity, and topic matching.",
  alternates: { canonical: "/suggest/" },
  openGraph: {
    title: "Venue Suggester — Find Target Conferences & Journals for Your Paper",
    description:
      "Paste your paper title and abstract to get ranked CS conference and journal suggestions tailored by CORE prestige tiers, SJR quartiles, and topics.",
    images: [
      {
        url: ogImageUrl,
        width: 1200,
        height: 630,
        alt: "ConferenceRank Venue Suggester",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Venue Suggester — Find Target Conferences & Journals for Your Paper",
    description:
      "Paste your paper title and abstract to get ranked CS conference and journal suggestions tailored by CORE prestige tiers, SJR quartiles, and topics.",
    images: [ogImageUrl],
  },
};

export default function SuggestPage() {
  const conferences = getConferences();
  const journals = getJournals();

  // Build a slim payload for the client component (avoiding full serialization overhead)
  const slimVenues: SuggesterVenue[] = [
    ...conferences.map((c): SuggesterVenue => {
      const { rate, accepted } = latestStat(c);
      return {
        id: c.id,
        type: "conference",
        acronym: c.acronym,
        title: c.title,
        rank: c.rank,
        categories: c.categories,
        latest_rate: rate === null ? null : Math.round(rate * 100) / 100,
        latest_accepted: accepted,
        has_stats: Boolean(c.stats && c.stats.length > 0),
        topics: c.openalex?.topics?.slice(0, 8).map((t) => t.name),
      };
    }),
    ...journals.map((j): SuggesterVenue => {
      const q = getJournalQuartile(j);
      return {
        id: j.id,
        type: "journal",
        acronym: j.acronym ?? "",
        title: j.title,
        rank: j.core_rank ?? q ?? "Unranked",
        core_rank: j.core_rank,
        sjr_quartile: q,
        categories: j.categories,
        latest_rate: null,
        latest_accepted: null,
        has_stats: false,
        topics: j.openalex?.topics?.slice(0, 8).map((t) => t.name),
      };
    }),
  ];

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
            Paste your draft abstract to find the best-fitting computer science conferences and journals. We match vocabulary, methodologies, and topics across CORE prestige tiers (A* to C) and SJR quartiles.
          </p>
        </div>

        {/* Interactive Client Component */}
        <SuggestClient venues={slimVenues} />

        <SiteFooter />
      </main>
    </div>
  );
}
