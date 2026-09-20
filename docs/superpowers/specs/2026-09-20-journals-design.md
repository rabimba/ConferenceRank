# Journal Rankings Feature Specification

- **Date:** 2026-09-20
- **Status:** Draft / Under Review
- **Target Platform:** Next.js static export on GitHub Pages (`conf-rank/`) + Python scraper pipeline (`scraper/`)

---

## 1. Context & Motivation

ConferenceRank provides comprehensive ranking, rank history, deadline tracking, and citation-topic insights for computer science conferences using CORE rankings, Paper Copilot, and OpenAlex. However, academic computer science researchers also publish extensively in journals (IEEE Transactions, ACM Transactions, Elsevier, Springer).

This feature adds first-class support for CS journals alongside conferences under the same web application, sharing visual components, search architecture, and analytics infrastructure while reflecting domain differences (e.g. rolling submissions vs. AoE deadlines; impact factor / SJR quartiles vs. acceptance rates).

---

## 2. Requirements & Scope

### 2.1 In Scope
1. **Journal Directory (`/journals`)**:
   - Filterable, searchable directory of ~2,200 CS journals.
   - Dual ranking display: CORE rank (`A*`, `A`, `B`, `C`) where available + SCImago Journal Rank (SJR) quartile (`Q1`, `Q2`, `Q3`, `Q4`).
   - Filters: Subject category (FoR / SJR subfields), Rank tier, SJR Quartile, Open Access status.
   - Sort options: Rank/Quartile, H-Index, SJR score, Total Works, Alphabetical.
2. **Journal Detail Page (`/journal/[id]`)**:
   - Metadata: Title, Acronym, Publisher, ISSN(s), DBLP URL, OpenAlex URL, Open Access indicator.
   - Rank history: CORE (2008–2020) + SJR quartile & score progression (1999–2025).
   - Topic composition: Interactive radar / pie charts and multi-year topic trends (powered by OpenAlex).
   - Top publishing institutions: Relative publication share across global institutions (powered by OpenAlex).
   - Works per year trajectory chart.
3. **Unified Venue Suggester (`/suggest`)**:
   - Paper abstract semantic / TF-IDF matcher returns mixed or filterable recommendations (Conferences vs. Journals).
4. **Scraper Pipeline Extensions (`scraper/`)**:
   - `fetch_core_journals.py`: Scrapes CORE 2020 and ERA 2010 journal CSVs + detail pages.
   - `fetch_sjr.py`: Ingests SCImago CS dataset (field 17xx), aggregates multi-decade historical metrics.
   - `fetch_openalex_journals.py`: Enriches journals using exact ISSN / title lookup on OpenAlex API.
   - `merge_journals.py`: Combines datasets into `conf-rank/src/data/journals.json`.

### 2.2 Out of Scope (YAGNI)
- **Deadlines Tab for Journals**: Standard journals operate on rolling submission deadlines. No artificial deadlines tab.
- **Acceptance Rates**: Unlike conferences, journals rarely publish standardized acceptance rates per year. We explicitly omit acceptance rates rather than introduce noisy/unreliable estimates.
- **Paywalled JCR metrics**: Exclude Clarivate JCR metrics due to proprietary licensing. We use open SJR indicators and OpenAlex 2-year citedness.

---

## 3. Data Architecture & Pipeline

### 3.1 Data Sources
| Source | Key Fields Extracted | Matching Key |
|---|---|---|
| **CORE Journal Rankings** (`portal.core.edu.au/jnl-ranks/`) | CORE rank (`A*`–`C`), rank history, FoR codes, ISSNs | Title, ISSN |
| **SCImago Journal Rank (SJR)** (Field `17xx` Computer Science) | SJR score, Quartile (`Q1`–`Q4`), H-Index, Publisher, Country, Year series | ISSN, Title |
| **OpenAlex API** (`api.openalex.org/sources`) | Topics, Institutions, Works/year, 2-year mean citedness, OA status | ISSN-L / ISSN |

### 3.2 Target Schema (`journals.json`)
```typescript
export interface Journal {
  id: string; // Slugified ID or ISSN-L
  title: string;
  acronym: string | null;
  issn: string[];
  publisher: string | null;
  country: string | null;
  core_rank: "A*" | "A" | "B" | "C" | "Unranked" | null;
  core_rank_history: Array<{
    source: string; // e.g. "CORE2020", "ERA2010"
    year: number;
    rank: string;
    for_code?: string;
  }>;
  sjr: {
    latest_score: number | null;
    latest_quartile: "Q1" | "Q2" | "Q3" | "Q4" | null;
    latest_h_index: number | null;
    history: Array<{
      year: number;
      sjr: number;
      quartile?: "Q1" | "Q2" | "Q3" | "Q4";
      h_index: number;
    }>;
  } | null;
  categories: string[]; // FoR mapping or SJR subfield classification
  dblp_url: string | null;
  is_oa: boolean;
  openalex?: {
    source_ids: string[];
    works_per_year: Record<string, number>;
    two_year_mean_citedness?: number;
    topics: Array<{ name: string; share: number }>;
    topics_by_year?: Record<string, Array<{ name: string; share: number }>>;
    top_institutions: Array<{ name: string; country: string; share: number }>;
  };
}
```

### 3.3 Scraper Pipeline Flow
```
1. fetch_core_journals.py  --> data/core_journals.json
2. fetch_sjr.py            --> data/sjr.json
3. fetch_openalex_journals.py --> data/openalex_journals.json
4. merge_journals.py       --> conf-rank/src/data/journals.json
```

---

## 4. Frontend Architecture (`conf-rank/`)

### 4.1 Navigation & Routing
- Global header updated with top-level tabs:
  - **Conferences** (`/`)
  - **Journals** (`/journals`)
  - **Deadlines** (`/deadlines` - Conferences only)
  - **Suggest** (`/suggest` - Unified)
- Route `/journal/[id]` loads individual journal detail page using dynamic parameters with Next.js static generation (`generateStaticParams`).

### 4.2 Shared vs. Specialized Components
- **`DualRankBadge.tsx`**: Displays CORE chip (`A*`, `A`, `B`, `C`) alongside SJR chip (`Q1`, `Q2`, `Q3`, `Q4`).
- **`JournalDirectory.tsx`**: Table/card view optimized for journals, including quartile badges, h-index, and citation stats.
- **`SJRHistoryChart.tsx`**: Renders SJR score and quartile trend over time (reusing Chart.js / SVG layout from existing conference charts).
- **`SuggestClient.tsx`**: Extended with a segmented toggle: `[All | Conferences | Journals]`.

---

## 5. Verification & Testing Plan

1. **Pipeline Verification**:
   - `fetch_core_journals.py`: Successfully downloads CORE2020 + ERA2010 exports and extracts detail history.
   - `fetch_sjr.py`: Correctly parses ~2,200 CS venues and aggregates history back to 1999 without memory issues.
   - `merge_journals.py`: Verifies zero data collision, valid JSON generation, and schema conformity.
2. **Build Verification**:
   - `npm run build` in `conf-rank/`: Clean TypeScript check, dynamic routes static compilation, and zero broken links.
3. **UI / Functional Verification**:
   - Filter and sort on `/journals` returns responsive, expected sets.
   - Direct link navigation to `/journal/[id]` works cleanly with full SEO / OpenGraph tags.
   - Suggester returns matching journals when relevant CS terms are supplied.
