# Zero-Touch Deadline & Venue Discovery Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the live site and static API update themselves daily with fresh CFP deadlines and automatically admit newly announced (non-CORE) conferences as "Emerging" venues, with no manual intervention.

**Architecture:** Split CI into three cadences — daily (deadlines + discovery + Pages deploy), weekly (acceptance stats + OpenAlex), monthly (CORE universe + journals + embeddings). Rewrite `fetch_deadlines.py` around a shared 3-tier venue resolver (DBLP slug → aliases → rank-aware acronym/title match) and add `discover_venues.py` which harvests OpenReview + unmatched community-feed venues, verifies them against DBLP/OpenAlex, and commits `discovered_venues.json`. `merge.py` appends verified venues with `emerging: true`; the UI shows an Emerging badge.

**Tech Stack:** Python 3.11 (requests, PyYAML), GitHub Actions (`workflow_run`, `schedule`), Next.js 16 / TypeScript for UI + types, pytest for scraper tests.

**Spec:** `docs/superpowers/plans/2026-11-14-zero-touch-updates.md` § "Approved Design" below (audit findings live in the conversation this plan was written from).

## Global Constraints

- Python CI version: `3.11` (existing `setup-python` step). No new pip dependencies beyond existing `requests`, `PyYAML`.
- Static API contract must not break: `api/index.json` endpoints and `counts` keys stay as-is (`conferences`, `journals`, `deadlines`, `journal_chunks`).
- Existing CORE venues keep numeric string ids (`"52"`); discovered venues get prefixed ids (`or-<acr>`, `dblp-<acr>`, `pc-<acr>`).
- Deadline timezone handling must match `conf-rank/src/lib/deadlines.ts` semantics: `AoE` = UTC-12; IANA names resolved via `Intl`; explicit offsets parsed.
- All JSON written by scrapers must be byte-deterministic across runs (sorted keys, sorted lists) — no Python `set` iteration order may leak into output.
- Never trigger deploy from a failed sanity gate: daily workflow must exit non-zero before commit if data shrinks or schema breaks.
- `conf-rank` must continue to pass: `./node_modules/.bin/tsc --noEmit && ./node_modules/.bin/eslint src && node --experimental-strip-types --test src/lib/*.test.ts` (run from `conf-rank/`).
- Scraper tests run with `PYTHONDONTWRITEBYTECODE=1 pytest -p no:cacheprovider` from `scraper/`; new tests must be offline (fixtures/mocks, no network).

## Review Focus

1. **Acronym collisions (FSE id 52 vs 1475)** — resolver must give the A* Foundations-of-Software-E Engineering conference its deadlines back; a person would expect the flagship venue, not the Fast Software Encryption workshop, to own `fse.iacr.org`-adjacent CFPs only when titles agree — pinned by `test_resolve_rank_aware_disambiguation` (Task 2).
2. **Dead/stale upstreams** — if `ccfddl` zip download fails, daily workflow must still succeed using any cached zip in `scraper/data/raw/deadlines/` (CI has none, so it must exit non-zero *before* commit, not push an empty dataset) — pinned by `test_build_deadlines_missing_source` (Task 3).
3. **Predatory/noise venues** — discovered venues without DBLP or OpenAlex verification must be rejected, and denylisted acronyms in `scraper/data/blocked_venues.json` must never appear — pinned by `test_verify_requires_evidence` / `test_blocked_venues_skipped` (Task 4).
4. **Deterministic output** — running `fetch_deadlines.py` twice in one process must produce identical bytes — pinned by `test_output_is_deterministic` (Task 3).
5. **Timezone drift in MCP** — an `Asia/Singapore`-zoned deadline must produce the same instant in the MCP server as on the site — pinned by `parseDdl` test (Task 8).

## Approved Design (spec body)

- **Cadences:** daily = `discover_venues.py` + `fetch_deadlines.py` + `merge.py` + Pages deploy; weekly = papercopilot, lixin, OpenAlex slice, merge; monthly = `fetch_core.py`, journal fetches, `merge_journals.py`, `embed_venues.py`.
- **Deploy fix:** `deploy.yml` gains `workflow_run` triggers (daily/weekly/monthly refresh workflows, `conclusion == 'success'`) plus a daily `schedule: "5 5 * * *"` rebuild so `api/deadlines.json` stays fresh even with zero commits. Existing `push` trigger stays.
- **Deadline sources (4 live):** ccfddl zip (+ its `accept_rates/*.yml`), sec-deadlines, `conference-deadlines/conference-deadlines.github.io` `_data/conferences.yml`, OpenReview API v2 groups. `paperswithcode/ai-deadlines` is removed.
- **Resolver:** DBLP slug → ALIASES/OVERRIDES → unique normalized acronym → rank-aware fuzzy title match (threshold 0.8), shared by `fetch_deadlines.py` and `discover_venues.py`.
- **Discovery:** candidates from OpenReview `/{Org}/{year}/Conference` group ids + venues unmatched by the resolver; verified via DBLP venue search API or OpenAlex `type:conference` source; denylist honored; output committed as `scraper/data/discovered_venues.json`.
- **Emerging venues:** `merge.py` appends them with `rank: "Unranked"`, `emerging: true`; UI shows an Emerging badge next to RankBadge for conferences only; they flow into search index, suggester, deadlines, static API, and monthly embeddings automatically.
- **Secondary fixes:** OpenAlex staleness refresh + API key + 429 backoff; MCP `parseDdl` timezone + de-hardcoded copy; `stats_source` widened to `string | null`; dead `scraper/data/directory.json` removed; `FORCE_FETCH=1` env bypasses raw caches.

---

### Task 1: Fix the deploy blackhole in `deploy.yml`

**Files:**
- Modify: `.github/workflows/deploy.yml:3-8` (triggers), `deploy.yml:20` (build job guard)

**Interfaces:**
- Produces: deploy workflow that also fires on `workflow_run` of `Daily Deadlines Refresh`, `Weekly Stats Refresh`, `Monthly Core & Journals Refresh` (names created in Tasks 5/7) and on a daily schedule.

- [ ] **Step 1: Add triggers to `deploy.yml` `on:` block**

Replace the current `on:` block with:

```yaml
on:
  push:
    branches: [main]
  pull_request:
    branches: [main]
  workflow_run:
    workflows: ["Daily Deadlines Refresh", "Weekly Stats Refresh", "Monthly Core & Journals Refresh"]
    types: [completed]
  schedule:
    - cron: "5 5 * * *"
  workflow_dispatch:
```

- [ ] **Step 2: Guard the build job for `workflow_run`/`schedule` events**

Add to the `build:` job (line 20) so it only runs for successful refresh runs and never for the daily schedule when nothing changed is still fine to build (schedule rebuild is desired):

```yaml
  build:
    if: >-
      github.event_name != 'workflow_run' ||
      github.event.workflow_run.conclusion == 'success'
```

- [ ] **Step 3: Verify YAML parses**

Run: `python3 -c "import yaml,sys; yaml.safe_load(open('.github/workflows/deploy.yml')); print('ok')"`
Expected: `ok`

- [ ] **Step 4: Commit**

```bash
git add .github/workflows/deploy.yml
git commit -m "ci(deploy): trigger Pages deploy from refresh workflows + daily rebuild"
```

---

### Task 2: Shared venue resolver module `scraper/venue_match.py`

**Files:**
- Create: `scraper/venue_match.py`
- Test: `scraper/test_venue_match.py`

**Interfaces:**
- Produces (used by Tasks 3 and 4):
  - `norm_acr(s: str) -> str` — lowercase, strip non-alphanumerics.
  - `ALIASES: dict[str, str]` — community acronym → CORE acronym (port the existing `ALIASES` dict out of `scraper/merge.py`; merge.py then imports it from here).
  - `OVERRIDES: dict[str, str]` — source-name → CORE numeric id, seeded with at least `{"SIGKDD": "26", "ACM SIGGRAPH": "38", "IEEE VR": "758", "SIGGRAPH Asia": "957", "SIGOPS ATC": "44", "EC": "14", "FSE": "52", "HRI": "2310"}`.
  - `resolve_venue(title: str, acronym: str, dblp_url: str | None, core: list[dict], extra_venues: list[dict] | None = None) -> dict | None` — returns the matched venue record (`{"id", "acronym", "title", "rank", "dblp_url", ...}`) or `None`.
  - `area_to_categories(areas: list[str]) -> list[str]` — maps ccfddl area codes to `conf-rank` category strings: `{"AI": "Artificial Intelligence", "CG": "Computer Vision & Multimedia", "CT": "Theory of Computation", "DB": "Data Management & Mining", "DS": "Distributed Systems & Networks", "HI": "Human-Computer Interaction", "MX": "General & Interdisciplinary CS", "NW": "Distributed Systems & Networks", "SC": "Cybersecurity & Privacy", "SE": "Software Engineering & PL"}`; unknown codes map to `"General & Interdisciplinary CS"`. Returns sorted unique list; empty input → `["General & Interdisciplinary CS"]`.

**Resolver algorithm (the one non-obvious body):**
Tier 1: if `dblp_url` is truthy, match against each venue's `dblp_url` by comparing the path after `dblp.org/(db/)?conf/` case-insensitively. Tier 2: `OVERRIDES[norm_acr(acronym)]`, then `ALIASES` normalization then unique normalized-acronym match across `[core + (extra_venues or [])]`. Tier 3: `difflib.SequenceMatcher` ratio of normalized titles ≥ 0.8; among candidates, prefer the higher CORE rank (`rank_order = {"A*": 0, "A": 1, "B": 2, "C": 3}` else 9) and longer acronym equality. Return `None` when nothing matches.

- [ ] **Step 1: Write failing tests in `scraper/test_venue_match.py`**

```python
import pytest
from venue_match import resolve_venue, area_to_categories, norm_acr

CORE = [
    {"id": "52", "acronym": "FSE", "title": "ACM International Conference on the Foundations of Software Engineering", "rank": "A*", "dblp_url": "https://dblp.org/db/conf/sigsoft/fse"},
    {"id": "1475", "acronym": "FSE", "title": "International Workshop on Fast Software Encryption", "rank": "B", "dblp_url": "https://dblp.org/db/conf/fse"},
    {"id": "26", "acronym": "KDD", "title": "ACM International Conference on Knowledge Discovery and Data Mining", "rank": "A*", "dblp_url": "https://dblp.org/db/conf/kdd"},
]

def test_resolve_by_dblp_slug():
    assert resolve_venue("Anything", "X", "https://dblp.org/db/conf/kdd", CORE)["id"] == "26"

def test_resolve_alias_and_overrides():
    assert resolve_venue("ACM Knowledge Discovery and Data Mining", "SIGKDD", None, CORE)["id"] == "26"

def test_resolve_rank_aware_disambiguation():
    # ccfddl "FSE" 2027 entry (conf.researchr.org, title says Foundations of Software Engineering)
    v = resolve_venue("International Conference on the Foundations of Software Engineering", "FSE", None, CORE)
    assert v["id"] == "52"

def test_unresolvable_returns_none():
    assert resolve_venue("Quantum Blockchain Summit", "QBS", None, CORE) is None

def test_area_mapping():
    assert area_to_categories(["AI", "SC", "ZZ"]) == ["Artificial Intelligence", "Cybersecurity & Privacy", "General & Interdisciplinary CS"]
    assert area_to_categories([]) == ["General & Interdisciplinary CS"]

def test_norm_acr():
    assert norm_acr("IEEE VIS") == "ieeevis"
```

- [ ] **Step 2: Run tests, expect failure** — `cd scraper && PYTHONDONTWRITEBYTECODE=1 pytest -p no:cacheprovider test_venue_match.py -v` → FAIL (`No module named 'venue_match'`).

- [ ] **Step 3: Implement `venue_match.py`** per the algorithm above.

- [ ] **Step 4: Re-run tests** → 6 passed.

- [ ] **Step 5: Refactor `scraper/merge.py` to `from venue_match import ALIASES, norm_acr`** (delete its local copies); run full scraper suite → all pass.

- [ ] **Step 6: Commit** — `git commit -m "feat(scraper): shared rank-aware venue resolver (dblp/alias/fuzzy)"`.

---

### Task 3: Rewrite `scraper/fetch_deadlines.py` (4 live sources, deterministic output, accept-rates)

**Files:**
- Modify: `scraper/fetch_deadlines.py` (full rewrite, keep module docstring format spec)
- Create: `scraper/data/ccf_accept_rates.json` (generated, committed)
- Test: `scraper/test_deadlines_build.py`

**Interfaces:**
- Consumes: `resolve_venue`, `norm_acr` from `venue_match.py`.
- Produces:
  - `scraper/data/deadlines.json` — `{core_or_discovered_id: [deadline entries]}`, keys sorted, entries sorted by `(year, paper_deadline, cycle or "")`. Entry schema unchanged (plus `source` now one of `"ccf" | "sec-deadlines" | "conference-deadlines" | "openreview"`).
  - `scraper/data/ccf_accept_rates.json` — `{normalized_acronym: [{year, rate, accepted, submitted}]}` parsed from ccfddl `accept_rates/*.yml` (fields per upstream: check `accep`/`notification` style keys at runtime; skip files whose schema doesn't yield all of rate/accepted/submitted).
- `merge.py` (Task 5) consumes `ccf_accept_rates.json` as a fourth stats tier (priority: manual > ccf_accept_rates > lixin > papercopilot), adding `stats_source` token `"ccfddl"`.

**Source adapters (each returns `list[dict]` with keys `title, acronym, dblp, year, deadlines[], source, areas[]`):**
1. `fetch_ccfddl()` — existing zip download → `raw/deadlines/ccf_deadlines.zip`; iterate `conference/**/*.yml`.
2. `fetch_sec()` — existing sec-deadlines JSON (keep current parsing).
3. `fetch_confdeadlines()` — GET `https://raw.githubusercontent.com/conference-deadlines/conference-deadlines.github.io/main/_data/conferences.yml`; map `deadlines[].date/abstract` (ISO with offset → `"YYYY-MM-DD HH:MM:SS"`), `tags: CORE-*` ignored for matching (CORE venues resolved via resolver), `areas` kept.
4. `fetch_openreview()` — GET `https://api2.openreview.net/groups?id=venues`; for each member id matching `^(?P<org>.+?)/20(2[5-9])/Conference$`, resolve `org` against the venue universe; if resolved, GET `https://api2.openreview.net/groups?id={id}` (0.2s sleep between calls) and regex-parse `content.date.value` for `Abstract Registration:` and `Submission Deadline:` segments (`%b %d %Y %I:%M%p` + trailing `UTC-?0` offset token); skip unparseable entries. `source: "openreview"`, `cfp_url` from `content.website.value`.

**Dedup rule:** same `(venue_id, year, paper_deadline normalized to date+time)` keeps the first by source priority `ccf > conference-deadlines > sec-deadlines > openreview`.

- [ ] **Step 1: Write failing tests in `scraper/test_deadlines_build.py`**

```python
def test_output_is_deterministic(build):  # build twice from same fixtures, assert identical canonical dict
def test_dedup_prefers_ccf(build):        # same venue/year/deadline from ccf + openreview -> source == "ccf"
def test_fse_id52_gets_deadlines(build):  # fixture: ccf entry "FSE" w/ dblp sigsoft/fse -> key "52" non-empty
def test_missing_source_is_tolerated(build):  # adapter raising NetworkError -> others still emitted
def test_accept_rates_parsed(tmp_path):   # tiny accept_rates yml fixture -> dict row w/ year, rate, accepted, submitted
```

- [ ] **Step 2: Run** `pytest test_deadlines_build.py -v` → FAIL.

- [ ] **Step 3: Implement** the four adapters + `build_deadlines(core, extra_venues, entries) -> dict` + `write_outputs()` (atomic write, sorted). Network adapters each wrapped so `requests.RequestException` degrades that source to `[]` with a stderr warning.

- [ ] **Step 4: Tests pass**, then live smoke: `PYTHONDONTWRITEBYTECODE=1 python3 fetch_deadlines.py` and assert via one-liner that `FSE` id 52 has entries, `SIGKDD`→26 matched, and total matched venues ≥ 360 (was 316).

- [ ] **Step 5: Commit** — `feat(scraper): deadline engine rewrite — 4 live sources, deterministic output, ccf accept rates`.

---

### Task 4: New-venue discovery `scraper/discover_venues.py`

**Files:**
- Create: `scraper/discover_venues.py`
- Create: `scraper/data/blocked_venues.json` — contents `[]` (empty denylist, schema `[{"acronym": str, "reason": str}]`)
- Create: `scraper/data/discovered_venues.json` — initial `[]`
- Test: `scraper/test_discover.py`

**Interfaces:**
- Consumes: `resolve_venue`, `area_to_categories`, `norm_acr` from `venue_match.py`.
- Produces: `scraper/data/discovered_venues.json` — sorted list of:
```json
{
  "id": "or-colm",
  "title": "Conference on Language Modeling",
  "acronym": "COLM",
  "rank": "Unranked",
  "for_codes": [],
  "categories": ["Artificial Intelligence"],
  "dblp_url": "https://dblp.org/db/conf/colm",
  "website": "https://colm.cc",
  "evidence": ["openreview:COLM/2026/Conference", "dblp:colm"],
  "emerging": true
}
```

**Pipeline:** harvest → filter → verify → merge-with-existing (existing entries never deleted unless denylisted; `evidence` lists union) → atomic sorted write.

1. **Harvest:** (a) OpenReview `/groups?id=venues` member ids matching `^(?P<acr>.+?)/20(2[5-9])/Conference$` — candidate id `or-<norm_acr>`, acronym `acr` (strip trailing `.org`/domain tokens, e.g. `AAAI.org`→`AAAI`); skip if `resolve_venue` matches a CORE venue (that one belongs to Task 3); (b) any Task-3 adapter entry that failed resolution with a real website/dblp link — id `dblp-<slug>` or `pc-<acr>`.
2. **Filter:** skip acronyms in `blocked_venues.json`; skip all-caps-len>1 workshop-looking names containing `Workshop|Symposium on (Persistent|Emerging)` no — simpler deterministic rule: skip when normalized acronym is empty or shorter than 2 chars.
3. **Verify (mockable):** `verify_fn(candidate) -> str | None` returns evidence token: DBLP `https://dblp.org/search/venue/api?q=<acr>&format=json` hit whose `venue` name fuzz-matches (ratio ≥ 0.6) → `dblp:<slug>`; else OpenAlex `https://api.openalex.org/sources?search=<title>&filter=type:conference` hit with ratio ≥ 0.75 → `openalex:<id>`. Unverified → dropped. Dependency-inject via `verify_fn: Callable = _default_verify` so tests never touch network.

- [ ] **Step 1: Write failing tests in `scraper/test_discover.py`**

```python
def test_verify_requires_evidence():      # verify_fn returns None -> candidate dropped
def test_blocked_venues_skipped():        # blocked_venues.json contains acronym -> dropped even if verified
def test_existing_entries_preserved():    # existing discovered_venues.json entry absent from harvest -> kept
def test_id_stable_and_sorted():          # two runs, same input -> identical file bytes
def test_openreview_acr_extraction():     # "AAAI.org/2027/Conference" -> acronym "AAAI", id "or-aaai"
```

- [ ] **Step 2: Run** → FAIL.

- [ ] **Step 3: Implement** `discover_venues.py` per pipeline above (argparse `--dry-run` prints summary without writing).

- [ ] **Step 4: Tests pass**; live smoke: `python3 discover_venues.py` then assert `COLM`, `MLSys` (or `MLSYS`), `RLC`, `3DV` or `RSS` appear in `discovered_venues.json`.

- [ ] **Step 5: Commit** — `feat(scraper): verified new-venue discovery from OpenReview + community feeds`.

---

### Task 5: `merge.py` — emerging venues in, `directory.json` out, ccf accept rates tier

**Files:**
- Modify: `scraper/merge.py` (main loop ~line 164, stats tiers ~lines 186-223, delete lines 255-296 writers for `directory.json`)

**Interfaces:**
- Consumes: `scraper/data/discovered_venues.json`, `scraper/data/ccf_accept_rates.json`, `deadlines.json` (keys now include discovered ids).
- Produces: `conf-rank/src/data/conferences.json` records gain `"emerging": true` on discovered venues only; `conf-rank/public/search-index.json` includes them (existing code path — it iterates `out`).

- [ ] **Step 1: Add discovered-venue append** after the `for v in core:` loop: build the same record shape with `rank: "Unranked"`, `rank_history: []`, `avg_rating: None`, `stats: None`, `stats_source: None`, `emerging: True`, `categories` from the discovered file, `deadlines` from `deadlines.get(dv["id"])`. Core records get no `emerging` key.
- [ ] **Step 2: Insert ccf accept-rates tier**: load `ccf_accept_rates.json` into `ccf_by_acr`; in the per-year combine, apply priority `manual > ccf > lixin > papercopilot` and add token `"ccfddl"` to `sources_used`.
- [ ] **Step 3: Delete the `directory.json` block** (lines ~255-296 through its print) and `git rm --cached scraper/data/directory.json`; add `scraper/data/directory.json` nowhere in workflows.
- [ ] **Step 4: Run** `python3 scraper/merge.py` → summary line shows `venues: 987 + N emerging`; `python3 -c` assert `COLM`-record has `emerging: true` and deadlines non-empty.
- [ ] **Step 5: Existing scraper pytest suite still passes** (`pytest -p no:cacheprovider`).
- [ ] **Step 6: Commit** — `feat(merge): admit emerging venues + ccfddl accept-rate tier; drop dead directory.json`.

---

### Task 6: UI — Emerging badge

**Files:**
- Modify: `conf-rank/src/lib/types.ts:54-68` (add `emerging?: boolean;` to `Conference`)
- Create: `conf-rank/src/components/EmergingBadge.tsx`
- Modify: every component rendering `RankBadge` for a conference (find via `grep -rn "RankBadge" conf-rank/src/components conf-rank/src/app`) — render `<EmergingBadge />` immediately after `<RankBadge …/>` when `conference.emerging` is true. Skip journal-only usages.

**Interfaces:**
- Produces: `EmergingBadge` — no props; renders a small pill (`text-[10px] uppercase tracking-wide`, amber palette consistent with existing badge styling in `RankBadge.tsx`) labeled `Emerging`, with `title` tooltip "Newly announced venue, not yet CORE-ranked".

- [ ] **Step 1: Add `emerging?: boolean` to `Conference` in `types.ts`.**
- [ ] **Step 2: Create `EmergingBadge.tsx`** (client-safe, no hooks).
- [ ] **Step 3: Wire into conference table row, conference detail header, and DeadlinesView row** at the `RankBadge` call sites found by grep.
- [ ] **Step 4: Verify** from `conf-rank/`: `./node_modules/.bin/tsc --noEmit && ./node_modules/.bin/eslint src && node --experimental-strip-types --test src/lib/*.test.ts` → clean.
- [ ] **Step 5: Visual smoke**: `npm run dev`, open `/conference/or-colm` and `/` — badge visible; emerging venues appear in the table.
- [ ] **Step 6: Commit** — `feat(ui): Emerging badge for newly discovered non-CORE venues`.

---

### Task 7: Workflow cadence split (daily / weekly / monthly)

**Files:**
- Create: `.github/workflows/deadlines.yml`
- Modify: `.github/workflows/refresh.yml` (remove `fetch_deadlines.py` line 35; commit step unchanged)
- Create: `.github/workflows/monthly.yml`

**`deadlines.yml` (exact):**
```yaml
name: Daily Deadlines Refresh

on:
  schedule:
    - cron: "0 5 * * *"
  workflow_dispatch:

permissions:
  contents: write

concurrency:
  group: data-refresh
  cancel-in-progress: false

jobs:
  refresh:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-python@v5
        with:
          python-version: "3.11"
          cache: "pip"
      - run: pip install -r scraper/requirements.txt
      - name: Discover new venues
        run: python3 scraper/discover_venues.py
      - name: Fetch deadlines
        run: python3 scraper/fetch_deadlines.py
      - name: Merge
        run: python3 scraper/merge.py
      - name: Sanity gate
        run: |
          python3 - <<'PY'
          import json
          confs = json.load(open("conf-rank/src/data/conferences.json"))
          assert len(confs) >= 900, f"conference count collapsed: {len(confs)}"
          assert all({"id", "title", "acronym", "rank"} <= set(c) for c in confs)
          emerging = [c for c in confs if c.get("emerging")]
          assert len(emerging) >= 1, "discovery produced zero emerging venues"
          print(f"sanity ok: {len(confs)} venues, {len(emerging)} emerging")
          PY
      - name: Commit and push
        run: |
          git config --global user.name "github-actions[bot]"
          git config --global user.email "github-actions[bot]@users.noreply.github.com"
          git add conf-rank/src/data/conferences.json conf-rank/public/search-index.json scraper/data/
          if git diff --staged --quiet; then
            echo "No deadline changes."
          else
            git commit -m "chore(data): daily deadline + venue discovery refresh"
            git push origin main
          fi
```

**`monthly.yml`**: same skeleton, `cron: "0 6 1 * *"`, steps: `fetch_core.py`, `fetch_sjr.py`, `fetch_core_journals.py`, `fetch_openalex_journals.py`, `merge_journals.py`, `fetch_openalex.py --limit 400` (continue-on-error), conditional embeddings:
```bash
git diff --quiet HEAD -- conf-rank/src/data/conferences.json || python3 scraper/embed_venues.py
```
commit path `conf-rank/src/data/ conf-rank/public/venue-embeddings.json scraper/data/`, message `chore(data): monthly core/journal/embedding refresh`.

- [ ] **Step 1: Create `deadlines.yml`** exactly as above.
- [ ] **Step 2: Trim `refresh.yml`** (drop the `fetch_deadlines.py` line; rename commit message to `chore(data): weekly acceptance-stats refresh`).
- [ ] **Step 3: Create `monthly.yml`.**
- [ ] **Step 4: YAML-parse all three** (`yaml.safe_load`) and `git add` + commit — `ci: split refresh into daily/weekly/monthly cadences`.

---

### Task 8: Secondary fixes (OpenAlex, MCP, types, raw caches)

**Files:**
- Modify: `scraper/fetch_openalex.py` (~line 238 `if vid in result: continue`; request params; 429 handling)
- Modify: `mcp/src/venues.ts` (`parseDdl` ~line 217), `mcp/src/index.ts` (hardcoded counts), `mcp/test/smoke.mjs` unchanged
- Modify: `conf-rank/src/lib/types.ts:65` (`stats_source: string | null`)
- Modify: `cached_get` in `fetch_lixin.py`, `fetch_papercopilot.py`, `fetch_core.py`, `fetch_sjr.py`, `fetch_openalex.py`

**Interfaces:**
- `fetch_openalex.py`: stored per-venue records gain `"fetched_at": "YYYY-MM-DD"`; skip re-fetch only when `fetched_at` within `--max-age-days` (default 180); env `OPENALEX_API_KEY` added as `api_key` query param; on HTTP 429 retry up to 3 times with `sleep(2 ** attempt + 5)`.
- `parseDdl(d: DeadlineEntry, mode: "paper" | "abstract"): number` — if `d.timezone` matches `/aoe|anywhere on earth/i` → UTC-12; else if it parses as `UTC±HH:MM`/`±HHMM` → that offset; else treat as IANA via `Intl.DateTimeFormat` longOffset (mirror `conf-rank/src/lib/deadlines.ts` `resolveIanaOffset`); fallback AoE when unknown. Existing callers pass `d` entries from the API — signature unchanged elsewhere.
- `cached_get(url, name, max_age_days=None)` in every fetcher: `FORCE_FETCH=1` env always refetches; otherwise honor `max_age_days` when provided (callers pass e.g. `max_age_days=7` for papercopilot/lixin HTML).

- [ ] **Step 1: OpenAlex fixes** (staleness, api_key, backoff) — verify: `python3 scraper/fetch_openalex.py --limit 2` locally rewrites only stale entries and `openalex.json` gains `fetched_at` keys.
- [ ] **Step 2: MCP timezone fix + copy**: rewrite `parseDdl` per above; replace hardcoded `"987 CS conferences + 11,782 journals"` strings in `mcp/src/index.ts` with `CS conferences and journals (see index.json counts)`. Run `cd mcp && node ./node_modules/typescript/bin/tsc --noEmit` → clean.
- [ ] **Step 3: Types + caches**: widen `stats_source` to `string | null`; apply `cached_get` signature change in the five fetchers.
- [ ] **Step 4: Full gates**: scraper pytest; `conf-rank` tsc/eslint/node --test — all green.
- [ ] **Step 5: Commit** — `fix(scraper,mcp): openalex staleness+key+backoff, mcp timezone, raw-cache TTL`.

---

### Task 9: End-to-end verification + push

- [ ] **Step 1: Local full daily pipeline**: `python3 scraper/discover_venues.py && python3 scraper/fetch_deadlines.py && python3 scraper/merge.py && cd conf-rank && npm run build` → build-api emits `public/api/` including emerging venues; `api/index.json` `counts.conferences` = new total.
- [ ] **Step 2: Spot-check data**: FSE (52) deadlines non-empty; SIGKDD (26) deadlines non-empty; ≥ 360 venues with deadlines; `or-colm` record has `emerging: true` + upcoming deadline.
- [ ] **Step 3: All test gates green** (scraper pytest, conf-rank tsc/eslint/tests, mcp tsc).
- [ ] **Step 4: Push branch and open PR** — title `feat: zero-touch daily deadline refresh + emerging venue discovery`; body links this plan; note the required post-merge action: verify `Daily Deadlines Refresh` runs and Pages deploys from `workflow_run` (first live proof of the deploy fix).

---

## Self-Review Notes

- Spec coverage: deploy fix (T1), resolver (T2), 4 sources + accept rates + determinism (T3), discovery + denylist (T4), emerging merge (T5), badge (T6), cadence split (T7), secondary fixes (T8), E2E (T9). All design sections have tasks.
- Type consistency: `resolve_venue(title, acronym, dblp_url, core, extra_venues=None)` used identically in T3/T4; `emerging: true` JSON field matches `emerging?: boolean` in T6.
- Review Focus items 1-5 all pinned by named tests in T2/T3/T4/T8.
