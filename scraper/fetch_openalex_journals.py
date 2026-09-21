"""Fetch OpenAlex data for academic & scientific journals: topics, topic trends, institutions, works/year, OA status, citation rate.

Matching:
  1. Exact ISSN lookup: /sources?filter=issn:{issn} (cleanest, >90% precision for journals)
  2. Fallback: /sources?search={title}&filter=type:journal with title overlap scoring

Per matched venue:
  - works per year (group_by=publication_year)
  - topics all-time top 8 (group_by=topics.id)
  - topics for last 5 complete years (filter publication_year)
  - institutions top 10 (group_by=institutions.id)
  - is_oa (open access status)
  - two_year_mean_citedness (from summary_stats)
  - publisher / country metadata

Output: scraper/data/openalex_journals.json
{issn_or_id: {source_ids, works_per_year, topics, topics_by_year, institutions, is_oa, two_year_mean_citedness, publisher, country}}
"""

import argparse
import datetime
import hashlib
import json
import os
import re
import time
import unicodedata
from pathlib import Path
import requests

from issn_utils import split_and_clean_issns, format_issn

API = "https://api.openalex.org"
UA = "conf-rank-scraper/1.0 (mailto:icore.conference.ranks@gmail.com)"
RAW = Path(__file__).parent / "data" / "raw" / "openalex_journals"
OUT = Path(__file__).parent / "data" / "openalex_journals.json"
JOURNALS = Path(__file__).parent.parent / "conf-rank" / "src" / "data" / "journals.json"
CA = os.environ.get("PROXY_CA", "/usr/local/etc/openssl/certs/paypal_proxy_cacerts.pem")
DELAY = 0.12
_y = datetime.date.today().year
LAST_5 = list(range(_y - 5, _y))

session = requests.Session()
session.headers.update({
    "User-Agent": UA,
    "Accept": "application/json",
})
if os.path.exists(CA):
    session.verify = CA

class RateLimited(Exception):
    pass

class FetchFailed(Exception):
    pass

def api_get(path: str, params: dict) -> dict:
    h = hashlib.sha256((path + json.dumps(params, sort_keys=True)).encode()).hexdigest()[:16]
    search_slug = re.sub(r"[^a-zA-Z0-9]+", "_", str(params.get("search", "") or params.get("filter", ""))).strip("_")[:30]
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
            r = session.get(url, params=params, timeout=25)
            if r.status_code == 200:
                data = r.json()
                if "error" in data or "Error" in data:
                    raise FetchFailed(f"API error for {path}: {str(data.get('error'))[:80]}")
                p.write_text(json.dumps(data), encoding="utf-8")
                time.sleep(DELAY)
                return data
            if r.status_code == 429:
                n_429 += 1
                backoff = 2 ** n_429
                if n_429 > 4:
                    raise RateLimited(f"OpenAlex 429 persistent ({n_429} in a row)")
                time.sleep(backoff)
                continue
            if r.status_code in (500, 502, 503, 504):
                time.sleep(2 ** attempt)
                continue
            if r.status_code == 404:
                return {}
            raise FetchFailed(f"HTTP {r.status_code} for {path}")
        except (requests.RequestException, json.JSONDecodeError) as e:
            if attempt == 5:
                raise FetchFailed(f"Fetch failed {path}: {e}")
            time.sleep(1 + attempt)
    return {}

def norm(s: str) -> str:
    s = unicodedata.normalize("NFKD", s)
    s = "".join(c for c in s if not unicodedata.combining(c))
    return re.sub(r"[^a-z0-9 ]+", " ", s.lower()).strip()

def title_overlap(t1: str, t2: str) -> float:
    w1 = set(norm(t1).split())
    w2 = set(norm(t2).split())
    if not w1 or not w2:
        return 0.0
    return len(w1 & w2) / max(len(w1), len(w2))

def match_source_by_issn(issn: str) -> dict | None:
    # OpenAlex expects hyphenated or plain ISSN in filter
    f_issn = format_issn(issn)
    d = api_get("/sources", {"filter": f"issn:{f_issn}", "per_page": 5})
    results = d.get("results", [])
    if results:
        return results[0]
    return None

def match_source_by_title(title: str) -> dict | None:
    clean_t = re.sub(r"[^a-zA-Z0-9\s]+", " ", title).strip()
    d = api_get("/sources", {"search": clean_t, "filter": "type:journal", "per_page": 5})
    best = None
    best_score = 0.0
    for s in d.get("results", []):
        name = s.get("display_name", "")
        score = title_overlap(title, name)
        if score > best_score:
            best_score = score
            best = s
    if best_score >= 0.70:
        return best
    return None

def group_counts(src_filter: str, group_by: str, extra: dict | None = None) -> list[dict]:
    params = {"filter": f"primary_location.source.id:{src_filter}",
              "group_by": group_by, "per_page": 30}
    if extra:
        for k, v in extra.items():
            params["filter"] += f",{k}:{v}"
    d = api_get("/works", params)
    out = []
    for g in d.get("group_by", []):
        out.append({"key": g["key"], "name": g.get("key_display_name", str(g["key"])), "count": g["count"]})
    return out

def fetch_journal_details(source: dict) -> dict:
    src_id = source["id"]
    wpy_raw = group_counts(src_id, "publication_year")
    works_per_year = {str(g["key"]): g["count"] for g in wpy_raw if str(g["key"]).isdigit()}
    
    topics_raw = group_counts(src_id, "topics.id")
    total_works = sum(g["count"] for g in topics_raw) or 1
    topics = [{"name": g["name"], "share": round(g["count"] / total_works, 4)}
              for g in topics_raw[:8]]
    
    topics_by_year = {}
    for y in LAST_5:
        ty = group_counts(src_id, "topics.id", {"publication_year": y})
        tot = sum(g["count"] for g in ty) or 1
        topics_by_year[str(y)] = [{"name": g["name"], "share": round(g["count"] / tot, 4)}
                                  for g in ty[:8]]
    
    inst_raw = group_counts(src_id, "institutions.id")
    total_inst = sum(g["count"] for g in inst_raw) or 1
    institutions = [{"name": g["name"], "country": "", "share": round(g["count"] / total_inst, 4)}
                    for g in inst_raw[:10]]
    
    summary = source.get("summary_stats", {})
    two_year = summary.get("2yr_mean_citedness") or summary.get("two_year_mean_citedness")
    
    return {
        "source_ids": [src_id],
        "works_per_year": works_per_year,
        "two_year_mean_citedness": round(float(two_year), 2) if two_year is not None else None,
        "topics": topics,
        "topics_by_year": topics_by_year,
        "institutions": institutions,
        "is_oa": bool(source.get("is_oa", False)),
        "publisher": source.get("host_organization_name") or None,
        "country": source.get("country_code") or None,
    }

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--limit", type=int, default=0,
                    help="max journals to process this run (0 = no limit)")
    ap.add_argument("--refresh-unmatched", action="store_true",
                    help="retry journals previously recorded as no-match")
    args = ap.parse_args()

    if not JOURNALS.exists():
        print(f"{JOURNALS} missing - run merge_journals.py first", flush=True)
        return
    journals = json.loads(JOURNALS.read_text())
    print(f"Total candidate journals: {len(journals)}", flush=True)

    result = {}
    if OUT.exists():
        try:
            result = json.loads(OUT.read_text())
            print(f"Resuming with {sum(1 for x in result.values() if x)} matched, "
                  f"{sum(1 for x in result.values() if x is None)} known no-match", flush=True)
        except (json.JSONDecodeError, OSError):
            result = {}

    def save():
        tmp = OUT.with_suffix(".tmp")
        tmp.write_text(json.dumps(result, indent=1))
        os.replace(tmp, OUT)

    matched = sum(1 for x in result.values() if x)
    processed = 0

    try:
        for i, j in enumerate(journals, 1):
            jid = j["id"]
            # Primary lookup key in result is jid
            if jid in result and (result[jid] is not None or not args.refresh_unmatched):
                continue
            if args.limit and processed >= args.limit:
                print(f"--limit {args.limit} reached; stopping", flush=True)
                break
            processed += 1

            source = None
            # 1. Try match by ISSN
            for raw_i in j.get("issn", []):
                for clean_i in split_and_clean_issns(raw_i):
                    source = match_source_by_issn(clean_i)
                    if source:
                        break
                if source:
                    break

            # 2. Try match by title
            if not source and j.get("title"):
                source = match_source_by_title(j["title"])

            if not source:
                result[jid] = None
            else:
                details = fetch_journal_details(source)
                result[jid] = details
                # Also index by ISSN so merge can look up either way
                for raw_i in j.get("issn", []):
                    for clean_i in split_and_clean_issns(raw_i):
                        result[clean_i] = details
                matched += 1

            if processed % 10 == 0:
                print(f"  processed {i}/{len(journals)} (new {processed}), matched {matched}", flush=True)
                save()
    except RateLimited as e:
        print(f"Rate-limited ({e}); saving progress and exiting.", flush=True)
    except FetchFailed as e:
        print(f"Fetch failed ({e}); saving progress and exiting.", flush=True)
    finally:
        save()
        print(f"Finished chunk. Total matched: {matched}")

if __name__ == "__main__":
    main()
