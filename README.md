# ConferenceRank

> One-stop shop to evaluate computer-science conference and journal venues: CORE/ICORE ranks, SCImago Journal Rank (SJR) quartiles, rank history, multi-decade acceptance-rate trends, upcoming submission deadlines (AoE), and venue recommendations.

🌐 **Live Website:** [https://rabimba.github.io/ConferenceRank/](https://rabimba.github.io/ConferenceRank/)

Deployed automatically to GitHub Pages via GitHub Actions.

## Features

- **Conference Rankings**: Complete CORE / ICORE rankings with multi-year rank progression (A*, A, B, C).
- **Journal Rankings**: Comprehensive computer-science journal rankings with dual ranking badges displaying CORE tiers (A*, A, B, C) and SCImago Journal Rank (SJR) quartiles (Q1, Q2, Q3, Q4) side-by-side, along with H-index, SJR score, publisher, ISSN search, and FoR category filters.
- **Venue & Journal Suggester**: Paper abstract matching using TF-IDF lexicon and ranking tiering to suggest target conferences and journals, with filters for venue type (conferences, journals, or all).
- **Upcoming Deadlines**: Submission deadlines for 300+ venues with live AoE countdown timers, 1-click Google Calendar sync, and `.ics` iCalendar export.
- **Target Watchlist**: Zero-login private conference tracking stored locally in your browser with deadline reminder alerts.
- **Acceptance Rates**: Historical acceptance statistics (accepted, submitted, rates) spanning decades for top-tier venues (systems, theory, databases, networks, security, AI/ML, NLP, vision, graphics).
- **Interactive Visualizations**: Interactive selectivity landscape, acceptance rate timelines, SJR history charts, topic share charts, and direct side-by-side venue comparisons.
- **Data Sources**: Integrated from CORE (conferences & journals), SCImago Journal Rank (SJR), csconferences, ccf-deadlines, ai-deadlines, sec-deadlines, Paper Copilot, lixin4ever, OpenAlex, and DBLP.
- **Automated Updates**: Scheduled GitHub Actions workflows automatically refresh statistics weekly and redeploy to GitHub Pages.

## For AI Agents

ConferenceRank is machine-consumable out of the box:

- **MCP server** (`mcp/`): `npx conferencerank-mcp` gives any MCP-capable agent six typed tools — `search_venues`, `get_venue`, `compare_venues`, `suggest_venues` (abstract → targets), `upcoming_deadlines` (paper/abstract modes), `acceptance_stats`. Data is cached locally and revalidated against the manifest. See [`mcp/README.md`](mcp/README.md).
- **Static JSON API**: `https://rabimba.github.io/ConferenceRank/api/` — `index.json` manifest, `conferences.json`, `journals-index.json`, per-letter `journals/{letter}.json` chunks, and `deadlines.json` (upcoming only). Regenerated on every build via `conf-rank/scripts/build-api.ts`.
- **Agent skill**: [`skills/conferencerank/SKILL.md`](skills/conferencerank/SKILL.md) teaches non-MCP agents how to query the API and interpret ranks/quartiles/deadlines.
- **llms.txt**: [`/llms.txt`](conf-rank/public/llms.txt) and [`/llms-full.txt`](conf-rank/public/llms-full.txt) ship with the site.


---

## License & Attribution

This project is licensed under the [Apache License, Version 2.0](LICENSE).

In accordance with Section 4(d) of the Apache-2.0 License, any redistribution, modification, or hosted derivative of this project must retain the attribution notice specified in the [NOTICE](NOTICE) file, linking back to [ConferenceRank](https://github.com/rabimba/ConferenceRank).

Rankings and metadata are subject to third-party data licenses:
- CORE Conference and Journal Rankings © Computing Research and Education Association of Australasia ([CORE](https://www.core.edu.au)).
- SCImago Journal & Country Rank data © SCImago Lab / Scopus (Elsevier B.V.), CC BY-NC-SA 4.0 ([SCImago](https://www.scimagojr.com)). Dataset compiled by Michael E. Rose.

Made with ❤️ by [Rabimba](https://rabimba.github.io/)
