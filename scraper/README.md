# ConferenceRank scrapers

Pipeline (run in order):

```
python3 fetch_core.py           # ~25 min: ICORE CSV + 987 detail pages (rank history)
python3 fetch_papercopilot.py   # ~2 min: acceptance stats from Paper Copilot
python3 fetch_lixin.py          # seconds: acceptance history from lixin4ever
# (Optional) manual_stats.json  # curated stats from csconferences + ccf-deadlines
python3 fetch_openalex.py       # ~45-90 min: topics, institutions, works/year
python3 merge.py                # merges all sources -> conf-rank/src/data/conferences.json
cd ../conf-rank && npm run build
```

All raw responses cached under `data/raw/` — re-runs are cheap and resume-safe.

## CLI flags

- `fetch_openalex.py --limit N` — process at most N new venues this run.
- `fetch_openalex.py --refresh-unmatched` — retry venues recorded as no-match.

## Venue embeddings (optional)

`embed_venues.py` writes `conf-rank/public/venue-embeddings.json` (int8-quantized
MiniLM vectors per venue) for future semantic search. Heavy deps isolated:

```
python3 -m venv .venv-embed && .venv-embed/bin/pip install -r requirements-embed.txt
.venv-embed/bin/python embed_venues.py
```

Not wired into the UI yet — the suggester uses lexicon + TF-IDF similarity
(`conf-rank/src/lib/similarity.ts`) so it works with zero extra JS deps.


## Data Sources

- **CORE Rankings**: © CORE / ICORE ranking portal.
- **Paper Copilot**: per-year acceptance rate, tiers (oral, poster), totals.
- **lixin4ever**: historical acceptance rates for major AI/ML/NLP/vision venues.
- **csconferences & ccf-deadlines (`manual_stats.json`)**: multi-decade acceptance rates for major systems, theory, databases, networks, graphics, and security venues (SIGCOMM, SOSP, OSDI, IEEE S&P, USENIX Security, SIGMOD, VLDB, MICRO, ISCA, ASPLOS, FAST, PLDI, POPL, STOC, FOCS, SODA, CRYPTO, etc.).
- **OpenAlex**: publication topics, topic trends, top publishing institutions.

## Notes

- **OpenAlex daily budget**: anonymous API has a small daily budget. When
  exhausted (`"Insufficient budget"` error), the run stops adding data and
  exits cleanly; re-run after midnight UTC — cache keeps all progress and
  `fetch_openalex.py` resumes where it left off.
- **Matching**: venues are matched to OpenAlex sources by acronym (strong) or
  title word overlap (≥0.5, conferences only, ≥50 works). Junk matches are
  filtered; expect ~150-300 confident matches out of 954 ranked venues.
- **Proxy CA**: set `PROXY_CA` env var to a custom CA bundle when behind a mitm
  proxy (defaults to a machine-local path, ignored if absent). For
  `embed_venues.py` / HF downloads also set `SSL_CERT_FILE`/`REQUESTS_CA_BUNDLE`.
- Rank data © CORE/ICORE. Acceptance stats © Paper Copilot, lixin4ever.
  Topics/institutions via OpenAlex (indexed subset, relative shares).
