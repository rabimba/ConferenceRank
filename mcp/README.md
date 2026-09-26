# conferencerank-mcp

MCP server exposing the [ConferenceRank](https://rabimba.github.io/ConferenceRank/) dataset to AI agents: CORE/ICORE conference ranks, SCImago journal quartiles, multi-decade acceptance rates, and upcoming submission deadlines — 987 conferences + 11,782 journals, refreshed weekly.

Data is served from the site's static JSON API and cached locally at `~/.cache/conferencerank/` with manifest-based revalidation. No API keys, no accounts.

## Install

**Claude Code**
```bash
claude mcp add conferencerank -- npx -y conferencerank-mcp
```

**Claude Desktop / opencode / generic MCP host**
```json
{
  "mcpServers": {
    "conferencerank": { "command": "npx", "args": ["-y", "conferencerank-mcp"] }
  }
}
```

## Tools

| Tool | What it does |
|---|---|
| `search_venues` | Text search (title/acronym/publisher/ISSN) with rank (`A*`–`C`, `Q1`–`Q4`) and discipline filters |
| `get_venue` | Full record: rank history, acceptance stats, SJR history, deadlines, OpenAlex topics |
| `compare_venues` | Side-by-side comparison of 2–10 venues |
| `suggest_venues` | Abstract → ranked venue suggestions (same TF-IDF + lexicon scoring as the site's /suggest page), with stretch/target/safe tiering and match reasons |
| `upcoming_deadlines` | Deadlines within N days, AoE-normalized, paper or abstract-registration mode, CFP links |
| `acceptance_stats` | Full per-year acceptance history for one conference |

## Configuration

| Env var | Purpose |
|---|---|
| `CONFERENCERANK_API_BASE` | Override API base URL (testing/mirrors) |
| `CONFERENCERANK_CACHE_DIR` | Override cache location |

## Development

```bash
npm run build     # tsc -> dist/
npm run smoke     # build + stdio handshake/tool smoke test (needs local API on :8899)
```

Smoke tests expect the site's `public/` served locally:

```bash
(cd ../conf-rank && npm run build:api && python3 -m http.server 8899 --directory public) &
npm run smoke
```

## Data licensing

Ranks © CORE (core.edu.au). Journal indicators © SCImago Lab / Scopus, CC BY-NC-SA 4.0. Acceptance stats © Paper Copilot & lixin4ever. Server code Apache-2.0.
