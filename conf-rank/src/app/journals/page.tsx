import type { Metadata } from "next";
import Link from "next/link";
import SiteHeader from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";
import JournalDirectory from "@/components/JournalDirectory";
import RankLegend from "@/components/RankLegend";
import { getJournals, getAllJournalCategories } from "@/lib/journal-data";
import { toDirectoryJournal } from "@/lib/directory-types";

export const metadata: Metadata = {
  title: "Academic & Scientific Journals | ConferenceRank",
  description:
    "Comprehensive directory of Computer Science and Scientific journals with CORE rankings, SCImago Journal Rank (SJR) indicators, and H-Index metrics.",
  alternates: { canonical: "/journals/" },
  openGraph: {
    title: "Academic & Scientific Journals | ConferenceRank",
    description:
      "Explore CORE rankings, SJR scores, H-index, and quartile classifications for premier Computer Science and scientific research journals.",
  },
};

export default function JournalsPage() {
  const journals = getJournals();
  const categories = getAllJournalCategories();
  const slimJournals = journals.map(toDirectoryJournal);
  const totalCount = journals.length;

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
            Academic &amp; Scientific Journals Directory
          </h1>
          <p className="mt-2 text-sm text-muted max-w-2xl">
            Explore academic and scientific journals across Computer Science, Physics, Mathematics, and related domains. View dual CORE and SCImago Journal Rank (SJR) indicators with H-Index citations.
          </p>
        </div>

        <RankLegend />

        <JournalDirectory journals={slimJournals} categories={categories} />

        <SiteFooter />
      </main>
    </div>
  );
}
