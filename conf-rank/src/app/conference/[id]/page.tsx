import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import SiteHeader from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";
import RankBadge from "@/components/RankBadge";
import WatchlistButton from "@/components/WatchlistButton";
import ConferenceDeadlineCard from "@/components/ConferenceDeadlineCard";
import {
  AcceptanceTrendChart,
  PapersPerYearChart,
  RankHistoryChart,
  TopicShareChart,
  TopicTrendChart,
} from "@/components/Charts";
import { getConference, getConferences } from "@/lib/data";

export function generateStaticParams() {
  return getConferences().map((c) => ({ id: c.id }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const c = getConference(id);
  if (!c) return {};
  const title = `${c.acronym} — ${c.title}`;
  const description = `CORE rank ${c.rank}. ${c.title}: acceptance rates, rank history, topics, top publishing institutions.`;
  const siteUrl =
    process.env.NEXT_PUBLIC_SITE_URL ??
    (process.env.GITHUB_ACTIONS === "true"
      ? `https://${(process.env.GITHUB_REPOSITORY ?? "rabimba/ConferenceRank").split("/")[0]}.github.io/${(process.env.GITHUB_REPOSITORY ?? "rabimba/ConferenceRank").split("/")[1]}`
      : "https://rabimba.github.io/ConferenceRank");
  const ogImageUrl = `${siteUrl.replace(/\/$/, "")}/og-image.png`;

  return {
    title,
    description,
    alternates: { canonical: `/conference/${c.id}/` },
    openGraph: {
      title,
      description,
      type: "article",
      images: [
        {
          url: ogImageUrl,
          width: 1200,
          height: 630,
          alt: `${c.acronym} — ${c.title}`,
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

export default async function ConferencePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const c = getConference(id);
  if (!c) notFound();

  const stats = [...(c.stats ?? [])].sort((a, b) => a.year - b.year);
  const rateData = stats
    .filter((s) => s.rate && s.rate > 0 && s.rate < 60)
    .map((s) => ({ year: s.year, rate: s.rate! }));
  const paperData = stats
    .filter((s) => s.accepted != null || s.submitted != null)
    .map((s) => ({
      year: s.year,
      accepted: s.accepted ?? s.accepted_short ?? undefined,
      submitted: s.submitted ?? s.submitted_short ?? s.total ?? undefined,
    }));
  const lastStat = stats[stats.length - 1];
  const histData = (c.rank_history ?? [])
    .filter((h) => h.year)
    .map((h) => ({ year: h.year!, rank: h.rank }))
    .sort((a, b) => a.year - b.year);

  const oa = c.openalex;
  const trendTopics = (() => {
    if (!oa) return { data: [], names: [] as string[] };
    const byYear = oa.topics_by_year ?? {};
    const years = Object.keys(byYear).sort();
    // pick top 5 topics by avg share across years
    const agg: Record<string, number[]> = {};
    for (const y of years)
      for (const t of byYear[y] ?? [])
        (agg[t.name] ??= []).push(t.share);
    const names = Object.entries(agg)
      .map(([n, arr]) => [n, arr.reduce((a, b) => a + b, 0) / arr.length] as const)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([n]) => n);
    const data = years.map((y) => {
      const row: Record<string, string | number> = { year: y };
      for (const n of names) {
        const t = (byYear[y] ?? []).find((x) => x.name === n);
        row[n] = t?.share ?? 0;
      }
      return row as { year: string; [k: string]: string | number };
    });
    return { data, names };
  })();

  const wpy = Object.entries(oa?.works_per_year ?? {})
    .map(([y, n]) => ({ year: +y, accepted: n }))
    .sort((a, b) => a.year - b.year);
  const recentWpy = wpy.filter((d) => d.year >= 2005);

  return (
    <div className="min-h-screen bg-background">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "Dataset",
            name: `${c.acronym} — ${c.title}`,
            description: `CORE rank ${c.rank}. Acceptance rates, rank history, topics, and top publishing institutions for ${c.title}.`,
            keywords: [c.acronym, c.title, ...c.categories].join(", "),
            isPartOf: { "@type": "WebSite", name: "ConferenceRank" },
          }),
        }}
      />
      <SiteHeader />
      <main className="mx-auto max-w-6xl space-y-5 px-4 py-8">
        <Link href="/" className="text-xs text-muted hover:underline hover:text-foreground">
          ← All venues
        </Link>

        {/* Header */}
        <div className="rounded-xl border border-border bg-surface p-6 shadow-xs">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-3">
              <RankBadge rank={c.rank} size="lg" />
              <h1 className="text-2xl font-black tracking-tight text-foreground">
                {c.acronym}
              </h1>
              <span className="text-muted">{c.title}</span>
            </div>
            <WatchlistButton venueId={c.id} acronym={c.acronym} size="md" showLabel={true} className="border border-border bg-surface px-3 py-1.5 shadow-xs" />
          </div>

          {/* Quick-take verdict summary */}
          <div className="mt-3 rounded-lg border border-border bg-stone-50/70 px-4 py-2.5 text-xs text-foreground/80 dark:bg-stone-900/60">
            <span className="font-semibold text-foreground">Quick take: </span>
            {c.rank === "A*"
              ? "Flagship international venue (top 7.5% tier). Highly competitive with premier global impact."
              : c.rank === "A"
                ? "Premier venue (top ~13% tier). Excellent track record and strong international visibility."
                : c.rank === "B"
                  ? "Established international conference with solid peer-review standards."
                  : c.rank === "C"
                    ? "Recognized venue meeting standard peer-review criteria."
                    : `Conference ranked as ${c.rank} in CORE/ICORE evaluation.`}
            {lastStat?.rate != null && (
              <span className="ml-1 font-medium text-accent">
                Recent acceptance rate: {lastStat.rate}% ({lastStat.year}).
              </span>
            )}
          </div>

          <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
            {c.categories.map((cat) => (
              <span
                key={cat}
                className="rounded-full bg-accent-soft px-2.5 py-1 font-medium text-accent"
              >
                {cat}
              </span>
            ))}
            {c.avg_rating && (
              <span className="rounded-full bg-amber-50 px-2.5 py-1 font-medium text-amber-800
                               dark:bg-amber-950 dark:text-amber-300">
                ★ {c.avg_rating} community rating
              </span>
            )}
            {c.dblp_url && (
              <a
                href={c.dblp_url}
                target="_blank"
                rel="noopener noreferrer"
                className="rounded-full bg-stone-100 px-2.5 py-1 font-medium text-stone-700 hover:bg-stone-200
                           dark:bg-stone-800 dark:text-stone-300 dark:hover:bg-stone-700"
              >
                DBLP ↗
              </a>
            )}
            {/^\d+$/.test(c.id) && (
              <a
                href={`https://portal.core.edu.au/conf-ranks/${c.id}/`}
                target="_blank"
                rel="noopener noreferrer"
                className="rounded-full bg-stone-100 px-2.5 py-1 font-medium text-stone-700 hover:bg-stone-200
                           dark:bg-stone-800 dark:text-stone-300 dark:hover:bg-stone-700"
              >
                ICORE ↗
              </a>
            )}
          </div>
          {stats.length > 0 && lastStat && (
            <div className="mt-4 flex flex-wrap gap-6 text-sm">
              <div>
                <div className="text-2xl font-black text-foreground">
                  {lastStat.rate != null
                    ? `${lastStat.rate}%`
                    : lastStat.rate_short != null
                      ? `${lastStat.rate_short}% (short)`
                      : "—"}
                </div>
                <div className="text-xs text-muted">
                  acceptance ({lastStat.year})
                </div>
              </div>
              <div>
                <div className="text-2xl font-black text-foreground">
                  {(lastStat.accepted ?? lastStat.accepted_short)?.toLocaleString() ?? "—"}
                </div>
                <div className="text-xs text-muted">
                  papers accepted ({lastStat.year})
                </div>
              </div>
              <div>
                <div className="text-2xl font-black text-foreground">
                  {(
                    lastStat.submitted ??
                    lastStat.submitted_short ??
                    lastStat.total
                  )?.toLocaleString() ?? "—"}
                </div>
                <div className="text-xs text-muted">
                  submissions ({lastStat.year})
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Next Submission Deadline Callout */}
        <ConferenceDeadlineCard venue={c} deadlines={c.deadlines} />

        {/* Acceptance trend + papers */}
        {rateData.length > 1 && (
          <Section
            title="Acceptance-rate trend"
            note={
              c.stats_source === "papercopilot"
                ? "Data: Paper Copilot"
                : c.stats_source === "papercopilot+lixin4ever"
                  ? "Data: Paper Copilot + lixin4ever"
                  : "Data: lixin4ever/Conference-Acceptance-Rate"
            }
          >
            <AcceptanceTrendChart data={rateData} />
          </Section>
        )}

        {paperData.length > 1 ? (
          <Section title="Papers per year">
            <PapersPerYearChart data={paperData} />
          </Section>
        ) : recentWpy.length > 3 ? (
          <Section
            title="Papers per year"
            note="OpenAlex-indexed subset — may undercount"
          >
            <PapersPerYearChart data={recentWpy} />
          </Section>
        ) : null}

        {/* Rank history */}
        {histData.length > 1 && (
          <Section
            title="Rank history (CORE → ICORE)"
            note="A* Flagship · A Premier · B Established · C Recognized"
          >
            <RankHistoryChart data={histData} />
          </Section>
        )}
        {histData.length === 1 && (
          <Section
            title="Rank history"
            note="A* Flagship · A Premier · B Established · C Recognized"
          >
            <p className="text-sm text-neutral-600 dark:text-neutral-400">
              {histData[0].rank} since {histData[0].year}
              {c.rank_history[0]?.source ? ` (${c.rank_history[0].source})` : ""}.
            </p>
          </Section>
        )}

        {/* Topics */}
        {oa && oa.topics && oa.topics.length > 0 && (
          <Section
            title="What this venue publishes"
            note="Topic mix over all indexed years — OpenAlex"
          >
            <TopicShareChart data={oa.topics} />
          </Section>
        )}

        {trendTopics.data.length > 1 && trendTopics.names.length > 0 && (
          <Section
            title="Topic trend (last 5 years)"
            note="Share of indexed papers per year — OpenAlex"
          >
            <TopicTrendChart data={trendTopics.data} />
          </Section>
        )}

        {/* Institutions */}
        {oa && oa.institutions && oa.institutions.length > 0 && (
          <Section
            title="Top publishing institutions"
            note="By indexed paper count — OpenAlex (multi-affiliation counts once per inst.)"
          >
            <ol className="space-y-1.5">
              {oa.institutions.map((inst, i) => (
                <li
                  key={inst.name}
                  className="flex items-center gap-3 rounded-lg px-2 py-1.5 text-sm odd:bg-stone-50
                             dark:odd:bg-stone-800/40"
                >
                  <span className="w-6 text-right font-black text-muted">
                    {i + 1}
                  </span>
                  <span className="font-medium text-foreground">{inst.name}</span>
                  <span className="ml-auto font-semibold text-muted">
                    {inst.count.toLocaleString()} papers
                  </span>
                </li>
              ))}
            </ol>
          </Section>
        )}

        {/* Year table */}
        {stats.length > 0 && (
          <Section title="Year-by-year detail">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[560px] text-sm">
                <thead>
                  <tr className="border-b border-stone-200 text-left text-xs uppercase tracking-wide text-muted
                                 dark:border-stone-800">
                    <th className="py-2 pr-4">Year</th>
                    <th className="py-2 pr-4">Submitted</th>
                    <th className="py-2 pr-4">Accepted</th>
                    <th className="py-2 pr-4">Rate</th>
                    <th className="py-2 pr-4">Tiers</th>
                    <th className="py-2">Location</th>
                  </tr>
                </thead>
                <tbody>
                  {[...stats].reverse().map((s) => (
                    <tr key={s.year} className="border-b border-stone-200/60 last:border-0
                                               dark:border-stone-800/60">
                      <td className="py-2 pr-4 font-semibold text-foreground tabular-nums">{s.year}</td>
                      <td className="py-2 pr-4 text-stone-700 dark:text-stone-300 tabular-nums">
                        {(s.submitted ?? s.total)?.toLocaleString() ?? "—"}
                      </td>
                      <td className="py-2 pr-4 text-stone-700 dark:text-stone-300 tabular-nums">
                        {(s.accepted ?? s.accepted_short)?.toLocaleString() ?? "—"}
                      </td>
                      <td className="py-2 pr-4 font-semibold text-foreground tabular-nums">
                        {s.rate != null ? `${s.rate}%` : s.rate_short != null ? `${s.rate_short}% (short)` : "—"}
                      </td>
                      <td className="py-2 pr-4 text-xs text-muted">
                        {s.tiers && Object.keys(s.tiers).length > 0
                          ? Object.entries(s.tiers)
                              .map(([k, v]) => `${k}: ${v.toLocaleString()}`)
                              .join(", ")
                          : s.note ?? ""}
                      </td>
                      <td className="py-2 text-muted">{s.location ?? "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Section>
        )}

        {stats.length === 0 && !oa && (
          <Section title="Acceptance statistics">
            <p className="text-sm text-muted">
              No acceptance-rate or topic data is available for this venue yet.
              See the{" "}
              <a
                className="text-accent hover:underline"
                href={`https://portal.core.edu.au/conf-ranks/${c.id}/`}
                target="_blank"
                rel="noopener noreferrer"
              >
                ICORE page
              </a>{" "}
              and DBLP for more information.
            </p>
          </Section>
        )}

        <SiteFooter />
      </main>
    </div>
  );
}
