# Journal Rankings Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement full journal rankings support with data ingestion pipelines, dual-ranking badges (CORE + SJR), directory listing, individual journal detail pages, and unified venue suggestions.

**Architecture:** Python scrapers produce `journals.json` statically loaded into Next.js. Next.js App Router exposes `/journals` (directory) and `/journal/[id]` (detail pages) using SSG (`generateStaticParams`). Suggestion engine in `SuggestClient.tsx` is updated to support both conferences and journals.

**Tech Stack:** Python 3 (Requests, CSV, JSON), Next.js 15+ (App Router, TypeScript, Tailwind CSS, Lucide icons).

**Spec:** `docs/superpowers/specs/2026-09-20-journals-design.md`

## Global Constraints

- Preserve all existing conference pages, data structures, and workflows without regressions.
- Static export compatibility for GitHub Pages (`next export` / `output: 'export'`).
- Type safety: Strict TypeScript typing for all journal models.
- Minimal payload impact: Keep generated JSON structures clean and compacted.

---

### Task 1: Journal Scraper - CORE Journal Importer

**Files:**
- Create: `scraper/fetch_core_journals.py`
- Test: `scraper/test_core_journals.py`

**Interfaces:**
- Produces: `scraper/data/core_journals.json` containing:
  `{ "id": string, "title": string, "rank": string, "source": string, "issns": string[], "for_codes": string[], "rank_history": Array<{ source: string, rank: string, for?: string }> }`

- [ ] **Step 1: Write test for CSV parsing and rank extraction**

```python
# scraper/test_core_journals.py
import pytest
from fetch_core_journals import parse_csv_line

def test_parse_csv_line():
    line = ["356", "ACM Computing Surveys", "CORE2020", "A*", "No", "0803", "", "", "0360-0300", "1557-7341", "", ""]
    rec = parse_csv_line(line)
    assert rec["id"] == "356"
    assert rec["title"] == "ACM Computing Surveys"
    assert rec["rank"] == "A*"
    assert "0360-0300" in rec["issns"]
    assert "1557-7341" in rec["issns"]
    assert rec["for_codes"] == ["0803"]
```

- [ ] **Step 2: Run test to verify it fails**

Run: `python3 -m pytest scraper/test_core_journals.py`
Expected: FAIL with `ModuleNotFoundError: No module named 'fetch_core_journals'`

- [ ] **Step 3: Implement minimal `fetch_core_journals.py`**

```python
# scraper/fetch_core_journals.py
import csv
import io
import json
import os
from pathlib import Path
import requests

BASE = "https://portal.core.edu.au/jnl-ranks/"
SOURCES = ["CORE2020", "ERA2010"]
RAW = Path(__file__).parent / "data" / "raw" / "core_journals"
OUT = Path(__file__).parent / "data" / "core_journals.json"
UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) conf-rank-scraper/1.0"

def parse_csv_line(rec):
    if len(rec) < 10:
        return None
    issns = [x.strip() for x in rec[8:12] if x.strip()]
    for_codes = [x.strip() for x in rec[5:8] if x.strip()]
    return {
        "id": rec[0].strip(),
        "title": rec[1].strip(),
        "source": rec[2].strip(),
        "rank": rec[3].strip(),
        "issns": issns,
        "for_codes": for_codes,
        "rank_history": [{"source": rec[2].strip(), "rank": rec[3].strip()}]
    }

def fetch_and_parse():
    RAW.mkdir(parents=True, exist_ok=True)
    all_journals = {}
    session = requests.Session()
    session.headers.update({"User-Agent": UA})

    for src in SOURCES:
        cache_file = RAW / f"export_{src}.csv"
        if cache_file.exists():
            text = cache_file.read_text(encoding="utf-8")
        else:
            url = f"{BASE}?search=&by=all&source={src}&do=Export"
            res = session.get(url, timeout=30)
            res.raise_for_status()
            text = res.text
            cache_file.write_text(text, encoding="utf-8")

        reader = csv.reader(io.StringIO(text))
        next(reader, None)  # header
        for row in reader:
            parsed = parse_csv_line(row)
            if not parsed:
                continue
            jid = parsed["id"]
            if jid in all_journals:
                # Add to rank history if from previous era
                all_journals[jid]["rank_history"].append({"source": src, "rank": parsed["rank"]})
            else:
                all_journals[jid] = parsed

    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(json.dumps(list(all_journals.values()), indent=1))
    return list(all_journals.values())

if __name__ == "__main__":
    journals = fetch_and_parse()
    print(f"Exported {len(journals)} CORE journals -> {OUT}")
```

- [ ] **Step 4: Run test to verify it passes**

Run: `python3 -m pytest scraper/test_core_journals.py`
Expected: PASS

- [ ] **Step 5: Fetch CORE journals data**

Run: `python3 scraper/fetch_core_journals.py`
Expected: Generates `scraper/data/core_journals.json` (~640-1000 items).

- [ ] **Step 6: Commit**

```bash
git add scraper/fetch_core_journals.py scraper/test_core_journals.py scraper/data/core_journals.json
git commit -m "feat(scraper): add CORE journal scraper and tests"
```

---

### Task 2: Journal Scraper - SCImago (SJR) Parser & Merger

**Files:**
- Create: `scraper/fetch_sjr.py`
- Create: `scraper/merge_journals.py`
- Test: `scraper/test_merge_journals.py`

**Interfaces:**
- Consumes: `scraper/data/core_journals.json`, SCImago dataset
- Produces: `conf-rank/src/data/journals.json` matching `Journal` schema

- [ ] **Step 1: Write test for merging CORE and SJR journals**

```python
# scraper/test_merge_journals.py
import pytest
from merge_journals import build_journal_record

def test_build_journal_record():
    core_item = {
        "id": "356",
        "title": "ACM Computing Surveys",
        "rank": "A*",
        "source": "CORE2020",
        "issns": ["0360-0300", "1557-7341"],
        "for_codes": ["0803"],
        "rank_history": [{"source": "CORE2020", "rank": "A*"}]
    }
    sjr_item = {
        "title": "ACM Computing Surveys",
        "latest_score": 4.12,
        "latest_quartile": "Q1",
        "latest_h_index": 185,
        "issns": ["03600300", "15577341"],
        "history": [{"year": 2024, "sjr": 4.12, "quartile": "Q1", "h_index": 185}]
    }
    rec = build_journal_record("acm-computing-surveys", core_item, sjr_item)
    assert rec["id"] == "acm-computing-surveys"
    assert rec["core_rank"] == "A*"
    assert rec["sjr"]["latest_quartile"] == "Q1"
    assert rec["sjr"]["latest_h_index"] == 185
```

- [ ] **Step 2: Run test to verify it fails**

Run: `python3 -m pytest scraper/test_merge_journals.py`
Expected: FAIL with `ModuleNotFoundError: No module named 'merge_journals'`

- [ ] **Step 3: Implement `scraper/fetch_sjr.py` and `scraper/merge_journals.py`**

```python
# scraper/fetch_sjr.py
import csv
import json
import os
import re
from pathlib import Path
import requests

SJR_CSV_URL = "https://raw.githubusercontent.com/Michael-E-Rose/SCImagoJournalRankIndicators/master/all.csv"
RAW_FILE = Path(__file__).parent / "data" / "raw" / "sjr_all.csv"
OUT = Path(__file__).parent / "data" / "sjr.json"

def clean_issn(s):
    return re.sub(r"[^0-9X]", "", s.upper())

def fetch_and_parse_sjr():
    RAW_FILE.parent.mkdir(parents=True, exist_ok=True)
    if not RAW_FILE.exists():
        print(f"Downloading {SJR_CSV_URL}...")
        r = requests.get(SJR_CSV_URL, stream=True)
        r.raise_for_status()
        with open(RAW_FILE, "wb") as f:
            for chunk in r.iter_content(chunk_size=65536):
                f.write(chunk)

    print("Parsing SJR CS journals...")
    journals = {}
    with open(RAW_FILE, "r", encoding="utf-8", errors="ignore") as f:
        reader = csv.DictReader(f)
        for row in reader:
            # CS field code starts with 17
            field = row.get("field", "")
            if not field.startswith("17"):
                continue
            title = row.get("Title", "").strip()
            if not title:
                continue
            year = int(row.get("year", 0))
            sjr_str = row.get("SJR", "").strip()
            sjr = float(sjr_str) if sjr_str else None
            h_index = int(row.get("h-index", 0)) if row.get("h-index") else None
            issn = clean_issn(row.get("Issn", ""))

            if title not in journals:
                journals[title] = {
                    "title": title,
                    "issns": set(),
                    "history": {}
                }
            if issn:
                journals[title]["issns"].add(issn)
            journals[title]["history"][year] = {
                "year": year,
                "sjr": sjr,
                "h_index": h_index
            }

    # Aggregate summaries
    out_list = []
    for title, data in journals.items():
        hist = sorted(data["history"].values(), key=lambda x: x["year"])
        latest = hist[-1] if hist else {}
        out_list.append({
            "title": title,
            "issns": list(data["issns"]),
            "latest_score": latest.get("sjr"),
            "latest_h_index": latest.get("h_index"),
            "history": hist
        })

    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(json.dumps(out_list, indent=1))
    print(f"Parsed {len(out_list)} CS journals from SJR -> {OUT}")
    return out_list

if __name__ == "__main__":
    fetch_and_parse_sjr()
```

```python
# scraper/merge_journals.py
import json
import re
from pathlib import Path

FOR_CATEGORIES = {
    "4601": "Applied Computing",
    "4602": "Artificial Intelligence",
    "4603": "Computer Vision & Multimedia",
    "4604": "Cybersecurity & Privacy",
    "4605": "Data Management & Mining",
    "4606": "Distributed Systems & Networks",
    "4607": "Graphics, VR & Games",
    "4608": "Human-Computer Interaction",
    "4609": "Information Systems",
    "4610": "Library & Information Studies",
    "4611": "Machine Learning",
    "4612": "Software Engineering & PL",
    "4613": "Theory of Computation",
    "4699": "General & Interdisciplinary CS",
    "0801": "Artificial Intelligence",
    "0802": "Theory of Computation",
    "0803": "Software Engineering & PL",
    "0804": "Data Management & Mining",
    "0805": "Distributed Systems & Networks",
    "0806": "Information Systems",
}

def slugify(title):
    s = title.lower()
    s = re.sub(r"[^a-z0-9]+", "-", s).strip("-")
    return s[:80]

def clean_issn(s):
    return re.sub(r"[^0-9X]", "", s.upper())

def build_journal_record(jid, core_item, sjr_item):
    title = (core_item or {}).get("title") or (sjr_item or {}).get("title")
    issns = set()
    if core_item:
        for i in core_item.get("issns", []):
            issns.add(i)
    if sjr_item:
        for i in sjr_item.get("issns", []):
            issns.add(i)

    categories = []
    if core_item:
        for fc in core_item.get("for_codes", []):
            if fc in FOR_CATEGORIES:
                cat = FOR_CATEGORIES[fc]
                if cat not in categories:
                    categories.append(cat)
    if not categories:
        categories = ["General & Interdisciplinary CS"]

    sjr_data = None
    if sjr_item:
        sjr_data = {
            "latest_score": sjr_item.get("latest_score"),
            "latest_quartile": sjr_item.get("latest_quartile"),
            "latest_h_index": sjr_item.get("latest_h_index"),
            "history": sjr_item.get("history", [])
        }

    return {
        "id": jid,
        "title": title,
        "acronym": None,
        "issn": list(issns),
        "publisher": None,
        "country": None,
        "core_rank": (core_item or {}).get("rank"),
        "core_rank_history": (core_item or {}).get("rank_history", []),
        "sjr": sjr_data,
        "categories": categories,
        "dblp_url": None,
        "is_oa": False
    }

def main():
    d = Path(__file__).parent / "data"
    out_file = Path(__file__).parent.parent / "conf-rank" / "src" / "data" / "journals.json"
    
    core_file = d / "core_journals.json"
    sjr_file = d / "sjr.json"

    core_list = json.loads(core_file.read_text()) if core_file.exists() else []
    sjr_list = json.loads(sjr_file.read_text()) if sjr_file.exists() else []

    # Map by cleaned ISSN and by title
    core_by_issn = {}
    core_by_title = {}
    for c in core_list:
        core_by_title[c["title"].lower().strip()] = c
        for i in c.get("issns", []):
            core_by_issn[clean_issn(i)] = c

    merged = []
    used_core_ids = set()

    # Process all SJR journals
    for s in sjr_list:
        matched_core = None
        for i in s.get("issns", []):
            ci = clean_issn(i)
            if ci in core_by_issn:
                matched_core = core_by_issn[ci]
                break
        if not matched_core:
            matched_core = core_by_title.get(s["title"].lower().strip())

        if matched_core:
            used_core_ids.add(matched_core["id"])

        jid = slugify(s["title"])
        rec = build_journal_record(jid, matched_core, s)
        merged.append(rec)

    # Add remaining unmatched CORE journals
    for c in core_list:
        if c["id"] not in used_core_ids:
            jid = slugify(c["title"])
            rec = build_journal_record(jid, c, None)
            merged.append(rec)

    out_file.parent.mkdir(parents=True, exist_ok=True)
    out_file.write_text(json.dumps(merged, indent=1))
    print(f"Merged {len(merged)} journals -> {out_file}")

if __name__ == "__main__":
    main()
```

- [ ] **Step 4: Run test to verify it passes**

Run: `python3 -m pytest scraper/test_merge_journals.py`
Expected: PASS

- [ ] **Step 5: Run merge to generate `conf-rank/src/data/journals.json`**

Run: `python3 scraper/merge_journals.py`
Expected: `conf-rank/src/data/journals.json` is generated.

- [ ] **Step 6: Commit**

```bash
git add scraper/fetch_sjr.py scraper/merge_journals.py scraper/test_merge_journals.py conf-rank/src/data/journals.json
git commit -m "feat(scraper): add SJR parser and journal merger"
```

---

### Task 3: Frontend Data Layer & Types for Journals

**Files:**
- Create: `conf-rank/src/lib/journal-types.ts`
- Create: `conf-rank/src/lib/journal-data.ts`
- Test: `conf-rank/src/lib/journal-data.test.ts`

**Interfaces:**
- Produces: `Journal`, `SJRRecord` interfaces; `getJournals(): Journal[]`, `getJournalById(id: string): Journal | undefined`, `getAllJournalCategories(): string[]`.

- [ ] **Step 1: Write test for journal data accessors**

```typescript
// conf-rank/src/lib/journal-data.test.ts
import { describe, it, expect } from "vitest";
import { getJournals, getJournalById } from "./journal-data";

describe("journal-data", () => {
  it("loads non-empty list of journals", () => {
    const list = getJournals();
    expect(list.length).toBeGreaterThan(0);
  });

  it("finds a journal by id", () => {
    const list = getJournals();
    const first = list[0];
    const found = getJournalById(first.id);
    expect(found).toBeDefined();
    expect(found?.title).toEqual(first.title);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd conf-rank && npx vitest run src/lib/journal-data.test.ts` (or standard test runner)
Expected: FAIL with module resolution error for `journal-data`.

- [ ] **Step 3: Define types and implement accessors**

```typescript
// conf-rank/src/lib/journal-types.ts
export interface SJRHistoryPoint {
  year: number;
  sjr: number | null;
  quartile?: "Q1" | "Q2" | "Q3" | "Q4";
  h_index: number | null;
}

export interface SJRData {
  latest_score: number | null;
  latest_quartile?: "Q1" | "Q2" | "Q3" | "Q4" | null;
  latest_h_index: number | null;
  history: SJRHistoryPoint[];
}

export interface JournalRankHistory {
  source: string;
  year?: number;
  rank: string;
  for_code?: string;
}

export interface Journal {
  id: string;
  title: string;
  acronym: string | null;
  issn: string[];
  publisher: string | null;
  country: string | null;
  core_rank: "A*" | "A" | "B" | "C" | "Unranked" | null;
  core_rank_history: JournalRankHistory[];
  sjr: SJRData | null;
  categories: string[];
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

```typescript
// conf-rank/src/lib/journal-data.ts
import journalsJson from "@/data/journals.json";
import { Journal } from "./journal-types";

const journals = journalsJson as unknown as Journal[];

export function getJournals(): Journal[] {
  return journals;
}

export function getJournalById(id: string): Journal | undefined {
  return journals.find((j) => j.id === id);
}

export function getAllJournalCategories(): string[] {
  const cats = new Set<string>();
  for (const j of journals) {
    for (const c of j.categories) {
      cats.add(c);
    }
  }
  return Array.from(cats).sort();
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd conf-rank && npx tsc --noEmit`
Expected: PASS with 0 errors.

- [ ] **Step 5: Commit**

```bash
git add conf-rank/src/lib/journal-types.ts conf-rank/src/lib/journal-data.ts
git commit -m "feat(data): add journal data models, types, and loader"
```

---

### Task 4: Dual Rank Badge Component

**Files:**
- Create: `conf-rank/src/components/DualRankBadge.tsx`
- Modify: `conf-rank/src/components/RankLegend.tsx`

**Interfaces:**
- Produces: `<DualRankBadge coreRank={...} sjrQuartile={...} />`

- [ ] **Step 1: Implement `DualRankBadge.tsx`**

```tsx
// conf-rank/src/components/DualRankBadge.tsx
import React from "react";

interface DualRankBadgeProps {
  coreRank?: string | null;
  sjrQuartile?: string | null;
  size?: "sm" | "md" | "lg";
}

export function DualRankBadge({ coreRank, sjrQuartile, size = "md" }: DualRankBadgeProps) {
  const sizeClasses = {
    sm: "text-xs px-1.5 py-0.5",
    md: "text-sm px-2.5 py-1",
    lg: "text-base px-3 py-1.5",
  }[size];

  const getCoreColor = (rank: string) => {
    switch (rank) {
      case "A*": return "bg-red-500/15 text-red-700 dark:text-red-400 border-red-500/30";
      case "A": return "bg-orange-500/15 text-orange-700 dark:text-orange-400 border-orange-500/30";
      case "B": return "bg-blue-500/15 text-blue-700 dark:text-blue-400 border-blue-500/30";
      case "C": return "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/30";
      default: return "bg-zinc-500/15 text-zinc-700 dark:text-zinc-400 border-zinc-500/30";
    }
  };

  const getSjrColor = (q: string) => {
    switch (q) {
      case "Q1": return "bg-purple-500/15 text-purple-700 dark:text-purple-400 border-purple-500/30";
      case "Q2": return "bg-indigo-500/15 text-indigo-700 dark:text-indigo-400 border-indigo-500/30";
      case "Q3": return "bg-sky-500/15 text-sky-700 dark:text-sky-400 border-sky-500/30";
      case "Q4": return "bg-slate-500/15 text-slate-700 dark:text-slate-400 border-slate-500/30";
      default: return "bg-zinc-500/15 text-zinc-700 dark:text-zinc-400 border-zinc-500/30";
    }
  };

  return (
    <div className="inline-flex items-center gap-1.5 flex-wrap">
      {coreRank && (
        <span className={`font-mono font-semibold rounded border ${sizeClasses} ${getCoreColor(coreRank)}`}>
          CORE {coreRank}
        </span>
      )}
      {sjrQuartile && (
        <span className={`font-mono font-semibold rounded border ${sizeClasses} ${getSjrColor(sjrQuartile)}`}>
          SJR {sjrQuartile}
        </span>
      )}
      {!coreRank && !sjrQuartile && (
        <span className={`font-mono rounded border ${sizeClasses} bg-zinc-500/15 text-zinc-500 border-zinc-500/20`}>
          Unranked
        </span>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Update `RankLegend.tsx` to document both CORE and SJR scales**

Read existing `RankLegend.tsx` and add an SJR tab or explanatory section for Q1-Q4.

- [ ] **Step 3: Verify TypeScript build**

Run: `cd conf-rank && npx tsc --noEmit`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add conf-rank/src/components/DualRankBadge.tsx conf-rank/src/components/RankLegend.tsx
git commit -m "feat(ui): add DualRankBadge for CORE and SJR rankings"
```

---

### Task 5: Journal Directory Page (`/journals`)

**Files:**
- Create: `conf-rank/src/components/JournalDirectory.tsx`
- Create: `conf-rank/src/app/journals/page.tsx`
- Modify: `conf-rank/src/components/SiteHeader.tsx`

**Interfaces:**
- Exposes route `/journals` with category filtering, search query filtering, quartile and rank filtering, and pagination/virtualization.

- [ ] **Step 1: Update `SiteHeader.tsx` to include Journals navigation**

Add "Journals" link pointing to `/journals` next to "Conferences" (`/`), "Deadlines" (`/deadlines`), and "Suggest" (`/suggest`).

- [ ] **Step 2: Implement `JournalDirectory.tsx`**

Provides search bar, category dropdown, rank tier filter (A*, A, B, C, Unranked), and quartile filter (Q1, Q2, Q3, Q4) displaying journal cards with `DualRankBadge`, H-index, and latest SJR score.

- [ ] **Step 3: Implement `src/app/journals/page.tsx`**

Standard Next.js page component rendering `JournalDirectory` with metadata title "Computer Science Journals | ConferenceRank".

- [ ] **Step 4: Verify Next.js build**

Run: `cd conf-rank && npm run build`
Expected: Route `/journals` compiles successfully into static export.

- [ ] **Step 5: Commit**

```bash
git add conf-rank/src/components/JournalDirectory.tsx conf-rank/src/app/journals/page.tsx conf-rank/src/components/SiteHeader.tsx
git commit -m "feat(journals): add journals directory page and header navigation"
```

---

### Task 6: Journal Detail Page (`/journal/[id]`)

**Files:**
- Create: `conf-rank/src/app/journal/[id]/page.tsx`
- Create: `conf-rank/src/components/SJRHistoryChart.tsx`

**Interfaces:**
- Implements `generateStaticParams()` returning `{ id: journal.id }` for every journal in `journals.json`.
- Displays metadata, rank histories, topic breakdowns, and top institutions.

- [ ] **Step 1: Implement `SJRHistoryChart.tsx`**

Plots SJR metric progression and H-Index trends over time using SVG or Chart.js compatible layout.

- [ ] **Step 2: Implement `src/app/journal/[id]/page.tsx`**

Provides complete detail view including breadcrumb, dual rank badges, ISSNs, publisher info, rank history table, and OpenAlex topic distributions if present.

- [ ] **Step 3: Build & verify static export**

Run: `cd conf-rank && npm run build`
Expected: Next.js pre-renders all `/journal/[id]` routes without type or SSR errors.

- [ ] **Step 4: Commit**

```bash
git add conf-rank/src/app/journal/[id]/page.tsx conf-rank/src/components/SJRHistoryChart.tsx
git commit -m "feat(journal): add journal detail page and SJR history chart"
```

---

### Task 7: Suggester Mixed Mode Support

**Files:**
- Modify: `conf-rank/src/components/SuggestClient.tsx`
- Modify: `conf-rank/src/lib/similarity.ts`

**Interfaces:**
- Consumes: `journals.json` alongside `conferences.json`
- Supports toggling suggestions by: `All`, `Conferences Only`, `Journals Only`.

- [ ] **Step 1: Update suggester to index both conferences and journals**

Extend the lexicon indexer to ingest titles and topics from `journals.json`, tagging each item with `type: "conference" | "journal"`.

- [ ] **Step 2: Add segmented type toggle in `SuggestClient.tsx`**

Add filter buttons `[All (default), Conferences, Journals]` above suggestion results.

- [ ] **Step 3: Build & run full project tests**

Run: `cd conf-rank && npm run build`
Expected: PASS with 0 build errors and static HTML files generated.

- [ ] **Step 4: Commit**

```bash
git add conf-rank/src/components/SuggestClient.tsx conf-rank/src/lib/similarity.ts
git commit -m "feat(suggest): add support for journal suggestions and venue type filter"
```

---

### Task 8: Verification, Attribution & CI Integration

**Files:**
- Modify: `NOTICE`
- Modify: `README.md`
- Modify: `scraper/README.md`

- [ ] **Step 1: Add SCImago and CORE Journal attribution to `NOTICE` and `README.md`**
- [ ] **Step 2: Run end-to-end build verification**

Run: `cd conf-rank && npm run build`
Expected: Build passes with all static routes emitted into `out/`.

- [ ] **Step 3: Commit**

```bash
git add NOTICE README.md scraper/README.md
git commit -m "docs: document journal data sources, citations, and scraper usage"
```
