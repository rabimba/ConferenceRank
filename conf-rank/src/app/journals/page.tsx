import type { Metadata } from "next";
import Link from "next/link";
import SiteHeader from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";
import JournalDirectory from "@/components/JournalDirectory";
import RankLegend from "@/components/RankLegend";
import { getJournals, getAllJournalCategories } from "@/lib/journal-data";
import type { Journal } from "@/lib/journal-types";

export const metadata: Metadata = {
  title: "Computer Science Journals | ConferenceRank",
  description:
    "Comprehensive directory of Computer Science journals with CORE rankings, SCImago Journal Rank (SJR) indicators, and H-Index metrics.",
  alternates: { canonical: "/journals/" },
  openGraph: {
    title: "Computer Science Journals | ConferenceRank",
    description:
      "Explore CORE rankings, SJR scores, H-index, and quartile classifications for premier Computer Science journals.",
  },
};

function toDirectoryJournal(j: Journal): Journal {
  return {
    id: j.id,
    title: j.title,
    acronym: j.acronym,
    issn: j.issn,
    publisher: j.publisher,
    country: j.country,
    core_rank: j.core_rank,
    core_rank_history: [],
    sjr: j.sjr
      ? {
          latest_score: j.sjr.latest_score,
          latest_quartile: j.sjr.latest_quartile,
          latest_h_index: j.sjr.latest_h_index,
          history: [],
        }
      : null,
    categories: j.categories,
    dblp_url: j.dblp_url,
    is_oa: j.is_oa,
  };
}

export default function JournalsPage() {
  const journals = getJournals();
  const categories = getAllJournalCategories();
  const slimJournals = journals.map(toDirectoryJournal);

  const totalCount = journals.length;
  const coreRankedCount = journals.filter(
    (j) => j.core_rank && ["A*", "A", "B", "C"].includes(j.core_rank)
  ).length;
  const sjrCount = journals.filter((j) => j.sjr?.latest_score != null).length;

  return (
    <div className="min-h-screen bg-background">
      <SiteHeader />
      <main className="mx-auto max-w-6xl px-4 py-8">
        <div className="mb-4">
          <Link
            href="/"
            className="inline-flex items-center gap-1 text-xs font-semibold text-muted hover:text-foreground transition"
          >
            ← Back to Conference Directory
          </Link>
        </div>

        <div className="mb-6">
          <div className="inline-flex items-center gap-2 rounded-full bg-accent-soft px-3 py-1 text-xs font-bold text-accent">
            <span>📚 Academic Journals</span>
            <span>•</span>
            <span>{totalCount.toLocaleString()} Indexed</span>
          </div>

          <h1 className="mt-3 text-2xl font-black tracking-tight text-foreground sm:text-3xl">
            Computer Science Journals Directory
          </h1>
          <p className="mt-1 text-sm text-muted">
            Tracked journals indexed by CORE prestige tier (A* to C) and SCImago Journal Rank (SJR) indicators.{" "}
            {coreRankedCount.toLocaleString()} CORE-ranked and {sjrCount.toLocaleString()} with SJR metrics.
          </p>
        </div>

        <RankLegend />

        <JournalDirectory journals={slimJournals} categories={categories} />

        <SiteFooter />
      </main>
    </div>
  );
}
