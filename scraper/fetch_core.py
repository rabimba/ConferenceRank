"""Fetch CORE/ICORE conference rankings.

1. CSV export per source edition (ICORE2026 ... CORE2008)
2. Detail pages /conf-ranks/{id}/ -> rank history + FoR + community ratings

Cached under scraper/data/raw/core/. Output: scraper/data/core.json
"""

import csv
import io
import json
import re
import time
from pathlib import Path

import requests

CA_BUNDLE = "/usr/local/etc/openssl/certs/paypal_proxy_cacerts.pem"

BASE = "https://portal.core.edu.au/conf-ranks/"
SOURCES = [
    "ICORE2026", "CORE2023", "CORE2021", "CORE2020", "CORE2018",
    "CORE2017", "CORE2014", "CORE2013", "ERA2010", "CORE2008",
]
RAW = Path(__file__).parent / "data" / "raw" / "core"
OUT = Path(__file__).parent / "data" / "core.json"
UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 conf-rank-scraper/1.0"
DELAY = 1.0

session = requests.Session()
session.headers.update({"User-Agent": UA})
try:
    import os
    if os.path.exists(CA_BUNDLE):
        session.verify = CA_BUNDLE
except Exception:
    pass


def cached_get(url: str, name: str) -> str:
    RAW.mkdir(parents=True, exist_ok=True)
    path = RAW / name
    if path.exists():
        return path.read_text(encoding="utf-8")
    r = session.get(url, timeout=60)
    r.raise_for_status()
    path.write_text(r.text, encoding="utf-8")
    time.sleep(DELAY)
    return r.text


def fetch_csv(source: str) -> list[dict]:
    url = f"{BASE}?search=&by=all&source={source}&do=Export"
    text = cached_get(url, f"export_{source}.csv")
    rows = []
    for rec in csv.reader(io.StringIO(text)):
        if not rec or len(rec) < 6:
            continue
        # id, title, acronym, source, rank, dblp, for1, for2, for3...
        rows.append({
            "id": rec[0].strip(),
            "title": rec[1].strip(),
            "acronym": rec[2].strip(),
            "rank": rec[4].strip(),
            "has_dblp": rec[5].strip().lower() == "yes",
            "for_codes": [c.strip() for c in rec[6:] if c.strip()],
        })
    return rows


DETAIL_RE = re.compile(
    r"Source:\s*(?P<source>[A-Z0-9]+)\s*</[^>]+>\s*"
    r"Rank:\s*(?P<rank>[^<]+?)\s*(?:</|$)",
    re.S,
)
FOR_RE = re.compile(r"Field Of Research:\s*([0-9A-Za-z]+)\s*-\s*([^<(]+)")
DBLP_RE = re.compile(r"DBLP Source:\s*<a[^>]*href=\"([^\"]+)\"")
TITLE_RE = re.compile(r"<h2[^>]*>([^<]+)</h2>")
RATING_RE = re.compile(r"Average User Rating:\s*([\d.N/A]+)")


def parse_detail(html: str) -> dict:
    history = []
    # Split by source blocks
    blocks = re.split(r"Source:\s*", html)
    for block in blocks[1:]:
        src_m = re.match(r"\s*([A-Z]{3,5}\d{4})", block)
        if not src_m:
            continue
        rank_m = re.search(r"Rank:\s*([^<\n]+)", block)
        for_m = re.search(r"Field Of Research:\s*([0-9A-Za-z]+)\s*-\s*([^<(\n]+)", block)
        if rank_m:
            entry = {"source": src_m.group(1), "rank": rank_m.group(1).strip()}
            if for_m:
                entry["for"] = for_m.group(1).strip()
                entry["for_name"] = for_m.group(2).strip()
            history.append(entry)
    title_m = TITLE_RE.search(html)
    dblp_m = DBLP_RE.search(html)
    rating_m = RATING_RE.search(html)
    return {
        "title": title_m.group(1).strip() if title_m else None,
        "dblp_url": dblp_m.group(1) if dblp_m else None,
        "avg_rating": rating_m.group(1).strip() if rating_m else None,
        "history": history,
    }


def main():
    print("Fetching CSV exports...")
    all_rows: dict[str, dict] = {}
    for source in SOURCES:
        rows = fetch_csv(source)
        print(f"  {source}: {len(rows)} rows")
        if source == "ICORE2026":
            for r in rows:
                all_rows[r["id"]] = r

    print(f"Total venues (ICORE2026): {len(all_rows)}")

    print("Fetching detail pages (rank history)...")
    done = 0
    for vid, row in all_rows.items():
        try:
            html = cached_get(f"{BASE}{vid}/", f"detail_{vid}.html")
        except Exception as e:
            print(f"  ! {vid}: {e}")
            continue
        d = parse_detail(html)
        row["rank_history"] = d["history"]
        if d["dblp_url"] and row.get("has_dblp"):
            row["dblp_url"] = d["dblp_url"]
        if d["avg_rating"] and d["avg_rating"] != "N/A":
            row["avg_rating"] = d["avg_rating"]
        done += 1
        if done % 100 == 0:
            print(f"  {done}/{len(all_rows)}")

    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(json.dumps(list(all_rows.values()), indent=1))
    print(f"Wrote {len(all_rows)} venues -> {OUT}")


if __name__ == "__main__":
    main()
