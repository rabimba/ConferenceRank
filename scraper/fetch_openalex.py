"""Fetch OpenAlex data per CORE venue: topics, topic trends, institutions, works/year.

Matching: /sources?search={acronym} -> type=conference, fuzzy score vs
acronym + title. Curated overrides for known-fragmented venues.

Per matched venue:
  - works per year (group_by=publication_year)
  - topics all-time top 8 (group_by=topics.id)
  - topics for last 5 complete years (filter publication_year)
  - institutions top 10 (group_by=institutions.id)

Output: scraper/data/openalex.json
{core_id: {source_ids, works_per_year, topics, topics_by_year, institutions}}
"""

import argparse
import datetime
import json
import os
import re
import time
import unicodedata
from pathlib import Path

import requests

API = "https://api.openalex.org"
UA = "conf-rank-scraper/1.0 (mailto:icore.conference.ranks@gmail.com)"
RAW = Path(__file__).parent / "data" / "raw" / "openalex"
OUT = Path(__file__).parent / "data" / "openalex.json"
CORE = Path(__file__).parent / "data" / "core.json"
CA = os.environ.get("PROXY_CA", "/usr/local/etc/openssl/certs/paypal_proxy_cacerts.pem")
DELAY = 0.15  # OpenAlex polite pool
_y = datetime.date.today().year
LAST_5 = list(range(_y - 5, _y))  # last 5 complete years


session = requests.Session()
session.headers.update({
    "User-Agent": UA,
    "Accept": "application/json",
})
if os.path.exists(CA):
    session.verify = CA


class RateLimited(Exception):
    """Raised when API keeps 429ing; abort run so venue isn't recorded as no-match."""


def api_get(path: str, params: dict) -> dict:
    """Fetch with session and local file caching."""
    import hashlib
    h = hashlib.sha256((path + json.dumps(params, sort_keys=True)).encode()).hexdigest()[:16]
    search_slug = re.sub(r"[^a-zA-Z0-9]+", "_", str(params.get("search", ""))).strip("_")[:30]
    path_slug = re.sub(r"[^a-zA-Z0-9]+", "_", path).strip("_")
    cache_key = f"{path_slug}_{search_slug}_{h}"
    RAW.mkdir(parents=True, exist_ok=True)
    p = RAW / f"{cache_key}.json"
    if p.exists():
        return json.loads(p.read_text(encoding="utf-8"))

    url = f"{API}{path}"
    n_429 = 0
    for attempt in range(6):
        try:
            r = session.get(url, params=params, timeout=20)
            if r.status_code == 200:
                data = r.json()
                if "error" in data or "Error" in data:
                    print(f"  API error for {path}: {str(data.get('error'))[:80]}", flush=True)
                    return {}
                p.write_text(json.dumps(data), encoding="utf-8")
                time.sleep(DELAY)
                return data
            elif r.status_code == 404:
                return {}
            elif r.status_code == 429:
                n_429 += 1
                retry_after = int(r.headers.get("Retry-After", "10"))
                wait = min(retry_after, 120)
                print(f"  429 rate-limited; waiting {wait}s", flush=True)
                time.sleep(wait)
            else:
                time.sleep(2 ** attempt)
        except RateLimited:
            raise
        except Exception:
            time.sleep(2 ** attempt)
    if n_429 >= 3:
        raise RateLimited(f"persistent 429 on {path}")
    print(f"  gave up on {path} after retries", flush=True)
    return {}


def norm(s: str) -> str:
    s = unicodedata.normalize("NFKD", s)
    s = re.sub(r"[^a-z0-9 ]", "", s.lower())
    return re.sub(r"\s+", " ", s).strip()


def acronym_in(name: str, acronym: str) -> bool:
    """acronym appears as word/segment in source display name."""
    n, a = norm(name), norm(acronym)
    if not a:
        return False
    if re.search(rf"(^| ){re.escape(a)}( |$)", n):
        return True
    # squashed form e.g. 'computer vision and pattern recognition cvpr'
    return a in n.replace(" ", "") and len(a) >= 4


STOP = {
    "and", "of", "the", "in", "on", "for", "international", "conference",
    "symposium", "annual", "joint", "acm", "ieee", "proceedings", "workshop",
    "advances", "was",
}


def title_overlap(title: str, name: str) -> float:
    t, n = set(norm(title).split()), set(norm(name).split())
    if not t or not n:
        return 0.0
    t -= STOP
    n -= STOP
    if not t:
        return 0.0
    return len(t & n) / len(t)


def clean_search_title(t: str) -> str:
    t = re.sub(r"\(.*?\)", "", t)
    t = re.sub(r"^(?:ACM(?:/IEEE)?|IEEE(?:/ACM)?|USENIX|AAAI)\s+", "", t, flags=re.I)
    t = re.sub(r"^(?:International|Annual)\s+(?:Conference|Symposium)\s+(?:on|for)\s+", "", t, flags=re.I)
    t = re.sub(r"^Advances in\s+", "", t, flags=re.I)
    return t.strip(" ,-")


def match_source(acronym: str, title: str) -> dict | None:
    searches = []
    if acronym and len(acronym) >= 2:
        searches.append(acronym)
    ct = clean_search_title(title)
    if ct and ct != acronym:
        searches.append(ct)
    if title and title not in searches:
        searches.append(title.split(",")[0])

    best, best_score = None, 0.0
    for q in searches[:3]:
        d = api_get("/sources", {"search": q, "per_page": 25})
        for s in d.get("results", []):
            if s.get("type") not in ("conference", "proceedings", "journal"):
                continue
            name = s.get("display_name", "")
            score = 0.0
            if acronym and acronym_in(name, acronym):
                score = 1.0
            score = max(score, title_overlap(title, name))
            if s.get("type") == "journal":
                score = 0.0 if score < 0.8 else score * 0.7
            if acronym and len(re.sub(r"[^a-z0-9]", "", acronym.lower())) < 3 and score < 1.0:
                score = 0.0
            if score > best_score:
                best, best_score = s, score
        if best_score >= 0.8:
            break

    if best and best_score >= 0.5 and (best.get("works_count") or 0) >= 50:
        return {
            "id": best["id"].rsplit("/", 1)[1],
            "name": best["display_name"],
            "works": best.get("works_count"),
            "score": round(best_score, 2),
        }
    return None


def collect_sibling_sources(source_id: str, name: str) -> list[str]:
    """Find per-year sibling sources (e.g. '2022 IEEE/CVF CVPR') via search by name."""
    ids = [source_id]
    d = api_get("/sources", {"search": name, "per_page": 25})
    for s in d.get("results", []):
        if s.get("type") != "conference":
            continue
        sid = s["id"].rsplit("/", 1)[1]
        if sid != source_id and (s.get("works_count") or 0) >= 200 and \
           title_overlap(name, s["display_name"]) >= 0.6:
            ids.append(sid)
    return ids


def group_counts(src_filter: str, group_by: str, extra: dict | None = None) -> list[dict]:
    params = {"filter": f"primary_location.source.id:{src_filter}",
              "group_by": group_by, "per_page": 30}
    if extra:
        for k, v in extra.items():
            params["filter"] += f",{k}:{v}"
    d = api_get("/works", params)
    out = []
    for g in d.get("group_by", []):
        out.append({"key": g["key"], "name": g["key_display_name"], "count": g["count"]})
    return out


def fetch_venue(src_ids: list[str]) -> dict:
    filt = "|".join(src_ids)
    wpy_raw = group_counts(filt, "publication_year")
    works_per_year = {g["key"]: g["count"] for g in wpy_raw if str(g["key"]).isdigit()}
    topics_raw = group_counts(filt, "topics.id")
    total_works = sum(g["count"] for g in topics_raw) or 1
    topics = [{"name": g["name"], "share": round(g["count"] / total_works, 4)}
              for g in topics_raw[:8]]
    topics_by_year = {}
    for y in LAST_5:
        ty = group_counts(filt, "topics.id", {"publication_year": y})
        tot = sum(g["count"] for g in ty) or 1
        topics_by_year[str(y)] = [{"name": g["name"], "share": round(g["count"] / tot, 4)}
                                  for g in ty[:8]]
    inst_raw = group_counts(filt, "institutions.id")
    institutions = [{"name": g["name"], "count": g["count"]} for g in inst_raw[:10]]
    return {
        "source_ids": src_ids,
        "works_per_year": works_per_year,
        "topics": topics,
        "topics_by_year": topics_by_year,
        "institutions": institutions,
    }


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--limit", type=int, default=0,
                    help="max venues to process this run (0 = no limit)")
    ap.add_argument("--refresh-unmatched", action="store_true",
                    help="retry venues previously recorded as no-match")
    args = ap.parse_args()

    if not CORE.exists():
        print("core.json missing - run fetch_core.py first", flush=True)
        return
    core = json.loads(CORE.read_text())
    # Only attempt ranked venues (skip Unranked/National noise) to bound API load
    venues = [v for v in core if v.get("rank") and v["rank"].lower() not in
              ("unranked", "unranked: merged", "unranked: not primarily cs",
               "journal published", "journal published ", "multiconference")]
    print(f"Venues to match: {len(venues)}", flush=True)

    result = {}
    if OUT.exists():  # resume support
        result = json.loads(OUT.read_text())
        print(f"Resuming with {sum(1 for x in result.values() if x)} matched, "
              f"{sum(1 for x in result.values() if x is None)} known no-match", flush=True)

    def save():
        OUT.write_text(json.dumps(result))

    matched = sum(1 for x in result.values() if x)
    processed = 0
    try:
        for i, v in enumerate(venues, 1):
            vid = v["id"]
            if vid in result and (result[vid] is not None or not args.refresh_unmatched):
                continue
            if args.limit and processed >= args.limit:
                print(f"--limit {args.limit} reached; stopping", flush=True)
                break
            processed += 1
            m = match_source(v.get("acronym", ""), v.get("title", ""))
            if not m:
                result[vid] = None  # remember no-match; skip on future runs
            else:
                sibs = collect_sibling_sources(m["id"], m["name"])
                result[vid] = {"match": m, **fetch_venue(sibs)}
                matched += 1
            if processed % 10 == 0:
                print(f"  processed {i}/{len(venues)} (new {processed}), matched {matched}", flush=True)
                save()
    except RateLimited as e:
        print(f"Rate-limited persistently ({e}); saving progress and exiting.", flush=True)
    save()
    print(f"Matched {matched}/{len(venues)} -> {OUT}", flush=True)


if __name__ == "__main__":
    main()
