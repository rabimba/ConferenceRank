import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import SiteHeader from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";
import DualRankBadge from "@/components/DualRankBadge";
import WatchlistButton from "@/components/WatchlistButton";
import SJRHistoryChart from "@/components/SJRHistoryChart";
import { TopicShareChart } from "@/components/Charts";
import { getJournalById, getJournals } from "@/lib/journal-data";

export function generateStaticParams() {
  return getJournals().map((j) => ({ id: j.id }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const j = getJournalById(id);
  if (!j) return {};

  const nameStr = j.acronym ? `${j.acronym} — ${j.title}` : j.title;
  const rankStr = [
    j.core_rank ? `CORE ${j.core_rank}` : null,
    j.sjr?.latest_quartile ? `SJR ${j.sjr.latest_quartile}` : null,
    j.sjr?.latest_score != null ? `SJR score ${j.sjr.latest_score}` : null,
    j.sjr?.latest_h_index != null ? `H-Index ${j.sjr.latest_h_index}` : null,
  ]
    .filter(Boolean)
    .join(", ");

  const title = `${nameStr} | Journal Rankings`;
  const description = `${rankStr ? `${rankStr}. ` : ""}${j.title}: prestige ranking, SJR progression, H-Index trends, and bibliometric metrics.`;

  const siteUrl =
    process.env.NEXT_PUBLIC_SITE_URL ??
    (process.env.GITHUB_ACTIONS === "true"
      ? `https://${(process.env.GITHUB_REPOSITORY ?? "rabimba/ConferenceRank").split("/")[0]}.github.io/${(process.env.GITHUB_REPOSITORY ?? "rabimba/ConferenceRank").split("/")[1]}`
      : "https://rabimba.github.io/ConferenceRank");
  const ogImageUrl = `${siteUrl.replace(/\/$/, "")}/og-image.png`;

  return {
    title,
    description,
    alternates: { canonical: `/journal/${j.id}/` },
    openGraph: {
      title,
      description,
      type: "article",
      images: [
        {
          url: ogImageUrl,
          width: 1200,
          height: 630,
          alt: nameStr,
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [ogImageUrl],
    },
  };
}

function Section({
  title,
  note,
  children,
}: {
  title: string;
  note?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-xl border border-border bg-surface p-5 shadow-xs">
      <div className="mb-3 flex items-baseline justify-between gap-4">
        <h2 className="text-sm font-bold uppercase tracking-wide text-muted">
          {title}
        </h2>
        {note && <span className="text-[11px] text-muted">{note}</span>}
      </div>
      {children}
    </section>
  );
}

export default async function JournalPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const j = getJournalById(id);
  if (!j) notFound();

  const sjrHistory = [...(j.sjr?.history ?? [])].sort((a, b) => a.year - b.year);
  const coreHistory = [...(j.core_rank_history ?? [])];
  const oa = j.openalex;

  const quickTakeVerdict = (() => {
    if (j.core_rank === "A*") {
      return "Flagship international journal. Top-tier scholarly prestige with high global impact and selectivity.";
    }
    if (j.core_rank === "A") {
      return "Premier academic journal. Strong peer review, high citation visibility, and respected scholarly standards.";
    }
    if (j.core_rank === "B") {
      return "Established international journal with solid peer-review and indexed research contributions.";
    }
    if (j.core_rank === "C") {
      return "Recognized academic journal meeting baseline scholarly peer-review criteria.";
    }
    if (j.sjr?.latest_quartile === "Q1" || (j.sjr?.latest_score && j.sjr.latest_score >= 1.5)) {
      return "High-impact scholarly journal with prominent SCImago citation metrics.";
    }
    return "Peer-reviewed academic journal in Computer Science and related research domains.";
  })();

  return (
    <div className="min-h-screen bg-background">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "Periodical",
            name: j.title,
            alternateName: j.acronym ?? undefined,
            issn: j.issn,
            publisher: j.publisher ? { "@type": "Organization", name: j.publisher } : undefined,
            keywords: [j.title, j.acronym, ...j.categories].filter(Boolean).join(", "),
            isPartOf: { "@type": "WebSite", name: "ConferenceRank" },
          }),
        }}
      />
      <SiteHeader />
      <main className="mx-auto max-w-6xl space-y-5 px-4 py-8">
        {/* Breadcrumb Navigation */}
        <nav aria-label="Breadcrumb" className="flex items-center gap-2 text-xs text-muted">
          <Link href="/" className="hover:text-foreground hover:underline">
            Home
          </Link>
          <span>/</span>
          <Link href="/journals/" className="hover:text-foreground hover:underline">
            All Journals
          </Link>
          <span>/</span>
          <span className="truncate font-medium text-foreground max-w-xs sm:max-w-md">
            {j.acronym || j.title}
          </span>
        </nav>

        {/* Header Summary Card */}
        <div className="rounded-xl border border-border bg-surface p-6 shadow-xs">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-3">
              <DualRankBadge
                coreRank={j.core_rank}
                sjrQuartile={j.sjr?.latest_quartile}
                size="lg"
              />
              <h1 className="text-2xl font-black tracking-tight text-foreground sm:text-3xl">
                {j.title}
              </h1>
              {j.acronym && (
                <span className="rounded-md bg-stone-100 px-2 py-0.5 text-sm font-semibold text-stone-700 dark:bg-stone-800 dark:text-stone-300">
                  {j.acronym}
                </span>
              )}
            </div>
            <div className="flex items-center gap-2">
              <WatchlistButton
                venueId={j.id}
                acronym={j.acronym ?? j.title}
                size="md"
                showLabel={true}
                className="border border-border bg-surface px-3 py-1.5 shadow-xs"
              />
            </div>
          </div>

          {/* Publisher & Country Info */}
          {(j.publisher || j.country) && (
            <div className="mt-2 text-xs text-muted">
              {j.publisher && <span>Published by <strong className="font-semibold text-foreground/80">{j.publisher}</strong></span>}
              {j.publisher && j.country && <span className="mx-1.5">•</span>}
              {j.country && <span>{j.country}</span>}
            </div>
          )}

          {/* Quick-take verdict banner */}
          <div className="mt-3 rounded-lg border border-border bg-stone-50/70 px-4 py-2.5 text-xs text-foreground/80 dark:bg-stone-900/60">
            <span className="font-semibold text-foreground">Quick take: </span>
            {quickTakeVerdict}
            {j.sjr?.latest_score != null && (
              <span className="ml-1 font-medium text-accent">
                Latest SJR: {j.sjr.latest_score.toFixed(3)}
                {j.sjr.latest_h_index != null ? ` (H-Index: ${j.sjr.latest_h_index})` : ""}.
              </span>
            )}
          </div>

          {/* Metadata Badges & External Links */}
          <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
            {j.is_oa && (
              <span className="rounded-full bg-emerald-500/15 px-2.5 py-1 font-semibold text-emerald-700 dark:text-emerald-400 border border-emerald-500/30">
                Open Access 🔓
              </span>
            )}
            {j.issn.length > 0 && (
              <span className="rounded-full bg-stone-100 px-2.5 py-1 font-mono text-stone-700 dark:bg-stone-800 dark:text-stone-300">
                ISSN: {j.issn.join(", ")}
              </span>
            )}
            {j.categories.map((cat) => (
              <span
                key={cat}
                className="rounded-full bg-accent-soft px-2.5 py-1 font-medium text-accent"
              >
                {cat}
              </span>
            ))}
            {j.dblp_url && (
              <a
                href={j.dblp_url}
                target="_blank"
                rel="noopener noreferrer"
                className="rounded-full bg-stone-100 px-2.5 py-1 font-medium text-stone-700 hover:bg-stone-200 dark:bg-stone-800 dark:text-stone-300 dark:hover:bg-stone-700"
              >
                DBLP ↗
              </a>
            )}
          </div>

          {/* KPI Metrics Highlight Grid */}
          <div className="mt-5 grid grid-cols-2 gap-4 border-t border-border pt-4 sm:grid-cols-4">
            <div>
              <div className="text-2xl font-black text-foreground">
                {j.core_rank ?? "—"}
              </div>
              <div className="text-xs text-muted">CORE Rank</div>
            </div>
            <div>
              <div className="text-2xl font-black text-foreground">
                {j.sjr?.latest_score != null ? j.sjr.latest_score.toFixed(3) : "—"}
              </div>
              <div className="text-xs text-muted">SJR Score</div>
            </div>
            <div>
              <div className="text-2xl font-black text-foreground">
                {j.sjr?.latest_quartile ?? "—"}
              </div>
              <div className="text-xs text-muted">SJR Quartile</div>
            </div>
            <div>
              <div className="text-2xl font-black text-foreground">
                {j.sjr?.latest_h_index != null ? j.sjr.latest_h_index.toLocaleString() : "—"}
              </div>
              <div className="text-xs text-muted">H-Index</div>
            </div>
          </div>
        </div>

        {/* SJR Metric & H-Index Progression Chart */}
        <Section
          title="SJR Metric & H-Index Progression"
          note="Data: SCImago Journal Rank (Scopus-based citation metric)"
        >
          <SJRHistoryChart history={sjrHistory} />
        </Section>

        {/* Rank History Table */}
        {(coreHistory.length > 0 || sjrHistory.length > 0) && (
          <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
            {/* CORE / ERA Rank History */}
            <Section
              title="CORE / ERA Rank History"
              note="Prestige ratings over evaluation rounds"
            >
              {coreHistory.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-stone-200 text-left text-xs uppercase tracking-wide text-muted dark:border-stone-800">
                        <th className="py-2 pr-4">Evaluation Source</th>
                        <th className="py-2 pr-4">Year</th>
                        <th className="py-2 pr-4">Rank</th>
                        <th className="py-2">Field (FoR)</th>
                      </tr>
                    </thead>
                    <tbody>
                      {coreHistory.map((h, i) => (
                        <tr
                          key={`${h.source}-${h.year ?? i}`}
                          className="border-b border-stone-200/60 last:border-0 dark:border-stone-800/60"
                        >
                          <td className="py-2 pr-4 font-semibold text-foreground">
                            {h.source}
                          </td>
                          <td className="py-2 pr-4 text-muted tabular-nums">
                            {h.year ?? "—"}
                          </td>
                          <td className="py-2 pr-4 font-mono font-bold text-accent">
                            {h.rank}
                          </td>
                          <td className="py-2 text-xs text-muted">
                            {h.for_code ?? "—"}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p className="text-xs text-muted py-2">
                  No historical CORE or ERA evaluation rounds recorded.
                </p>
              )}
            </Section>

            {/* SJR Historical Data Table */}
            <Section
              title="Historical SJR & H-Index Records"
              note="Yearly progression from SCImago"
            >
              {sjrHistory.length > 0 ? (
                <div className="max-h-64 overflow-y-auto overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-stone-200 text-left text-xs uppercase tracking-wide text-muted dark:border-stone-800">
                        <th className="py-2 pr-4">Year</th>
                        <th className="py-2 pr-4">SJR Score</th>
                        <th className="py-2 pr-4">Quartile</th>
                        <th className="py-2">H-Index</th>
                      </tr>
                    </thead>
                    <tbody>
                      {[...sjrHistory].reverse().map((p) => (
                        <tr
                          key={p.year}
                          className="border-b border-stone-200/60 last:border-0 dark:border-stone-800/60"
                        >
                          <td className="py-2 pr-4 font-semibold text-foreground tabular-nums">
                            {p.year}
                          </td>
                          <td className="py-2 pr-4 text-stone-700 dark:text-stone-300 tabular-nums">
                            {p.sjr != null ? p.sjr.toFixed(3) : "—"}
                          </td>
                          <td className="py-2 pr-4 font-mono font-semibold text-muted">
                            {p.quartile ?? "—"}
                          </td>
                          <td className="py-2 font-mono tabular-nums text-foreground">
                            {p.h_index != null ? p.h_index : "—"}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p className="text-xs text-muted py-2">
                  No historical SJR table data available.
                </p>
              )}
            </Section>
          </div>
        )}

        {/* OpenAlex Topics & Top Publishing Institutions */}
        {oa && oa.topics && oa.topics.length > 0 && (
          <Section
            title="Research Topics Distribution"
            note="Indexed research topic share — OpenAlex"
          >
            <TopicShareChart data={oa.topics} />
          </Section>
        )}

        {oa && oa.top_institutions && oa.top_institutions.length > 0 && (
          <Section
            title="Top Publishing Institutions"
            note="By publication share — OpenAlex"
          >
            <ol className="space-y-1.5">
              {oa.top_institutions.map((inst, i) => (
                <li
                  key={`${inst.name}-${i}`}
                  className="flex items-center gap-3 rounded-lg px-2 py-1.5 text-sm odd:bg-stone-50 dark:odd:bg-stone-800/40"
                >
                  <span className="w-6 text-right font-black text-muted">
                    {i + 1}
                  </span>
                  <span className="font-medium text-foreground">{inst.name}</span>
                  {inst.country && (
                    <span className="text-xs text-muted">({inst.country})</span>
                  )}
                  <span className="ml-auto font-semibold text-muted">
                    {(inst.share * 100).toFixed(1)}% share
                  </span>
                </li>
              ))}
            </ol>
          </Section>
        )}

        {/* Detailed Journal Specifications */}
        <Section title="Journal Specifications & Metadata">
          <div className="grid grid-cols-1 gap-y-3 sm:grid-cols-2 text-sm">
            <div>
              <span className="text-xs font-semibold text-muted uppercase tracking-wide">
                ISSN
              </span>
              <p className="font-mono text-foreground">
                {j.issn.length > 0 ? j.issn.join(", ") : "—"}
              </p>
            </div>
            <div>
              <span className="text-xs font-semibold text-muted uppercase tracking-wide">
                Publisher
              </span>
              <p className="text-foreground">{j.publisher ?? "—"}</p>
            </div>
            <div>
              <span className="text-xs font-semibold text-muted uppercase tracking-wide">
                Country
              </span>
              <p className="text-foreground">{j.country ?? "—"}</p>
            </div>
            <div>
              <span className="text-xs font-semibold text-muted uppercase tracking-wide">
                Access Model
              </span>
              <p className="text-foreground">
                {j.is_oa ? "Open Access (DOAJ indexed)" : "Subscription / Hybrid"}
              </p>
            </div>
            <div className="sm:col-span-2">
              <span className="text-xs font-semibold text-muted uppercase tracking-wide">
                Subject Categories
              </span>
              <p className="text-foreground">
                {j.categories.length > 0 ? j.categories.join(", ") : "—"}
              </p>
            </div>
          </div>
        </Section>

        <SiteFooter />
      </main>
    </div>
  );
}
