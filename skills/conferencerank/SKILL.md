---
name: conferencerank
description: Query the ConferenceRank dataset — CORE/SJR ranks, acceptance-rate history, and submission deadlines for 987 CS conferences and 11,782 journals — via its static JSON API. Use when advising on where to submit a paper, evaluating whether a venue is legitimate or predatory, comparing venues, checking upcoming deadlines (including abstract-registration cutoffs), or looking up acceptance rates.
---

# ConferenceRank API

Static JSON over HTTPS. No auth. Base: `https://rabimba.github.io/ConferenceRank/api/`. Data refreshes weekly; revalidate against `index.json`'s `generatedAt`.

## Endpoints

| Endpoint | Contents |
|---|---|
| `index.json` | Manifest: version, generatedAt, counts |
| `conferences.json` | All 987 conferences, full records (rank, rank_history, stats, deadlines, categories, openalex) — ~1.2MB |
| `conference/{id}.json` | One conference (numeric id) |
| `journals-index.json` | Slim records for all 11,782 journals (id, title, acronym, core_rank, sjr_score, sjr_quartile, h_index, is_oa, categories, publisher, issn) — ~2MB |
| `journals/{letter}.json` | FULL journal records chunked by first char of id (`a`–`z`, `0`–`9`, `other`) |
| `deadlines.json` | Upcoming deadlines only, flattened with venue info, chronological |

**Fetching one journal:** find id in `journals-index.json` → GET `journals/{first-char-of-id}.json` → filter by id.

## How to answer common asks

1. **"Is venue X good?"** — fetch record; report BOTH `rank` (CORE: A* > A > B > C) and `sjr_quartile` (Q1 > Q4) + `h_index` when present. They measure different things (peer prestige vs citation impact).
2. **"How hard to get in?"** — read `stats` (per-year accepted/submitted/rate). <20% highly selective, 20–32% moderate, >35% accessible.
3. **"When's the deadline?"** — `deadlines.json`; surface `abstract_deadline` when present — missing abstract registration usually disqualifies the paper. Timezone is typically `AoE` (UTC-12). Always point user to `cfp_url` to verify.
4. **"Where should I submit this abstract?"** — load `conferences.json` + `journals-index.json`; match abstract keywords against `categories`, `title`, and conference `openalex.topics`; weight by rank tier. State match reasons.
5. **"Is this journal predatory?"** — absent from both CORE and SJR + unknown publisher = red flag. Say so plainly.

## Interpretation rules

- Legacy ranks `Australasian B/C`, `National` exist; treat below C.
- `stats` may be missing for smaller venues — say "no data" rather than guessing.
- Journal `sjr.history[]` covers 1999→present; rising vs declining trajectory matters when advising where to commit strong work.

## Licensing

Code Apache-2.0. Ranks © CORE (core.edu.au); journal indicators © SCImago/Scopus CC BY-NC-SA 4.0; acceptance stats © Paper Copilot & lixin4ever.

## MCP alternative

If the host supports MCP servers, prefer the packaged server (typed tools, local caching): `npx conferencerank-mcp` — see https://github.com/rabimba/ConferenceRank/tree/main/mcp
