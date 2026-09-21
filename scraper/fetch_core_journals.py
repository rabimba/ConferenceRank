import csv
import io
import json
import os
import time
from pathlib import Path
import requests

CA_BUNDLE = os.environ.get("PROXY_CA", "")

BASE = "https://portal.core.edu.au/jnl-ranks/"
SOURCES = ["CORE2020", "ERA2010"]
RAW = Path(__file__).parent / "data" / "raw" / "core_journals"
OUT = Path(__file__).parent / "data" / "core_journals.json"
UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) conf-rank-scraper/1.0"

CANONICAL_RANKS = {"A*", "A", "B", "C"}

def normalize_core_rank(raw_rank: str | None) -> tuple[str, str | None]:
    """
    Returns (canonical_rank, optional_note).
    Canonical ranks: 'A*', 'A', 'B', 'C', or 'Unranked'.
    """
    if not raw_rank:
        return "Unranked", None
    r = raw_rank.strip()
    if r in CANONICAL_RANKS:
        return r, None
    upper = r.upper()
    if upper in CANONICAL_RANKS:
        return upper, None
    # Check common unranked variations
    lower = r.lower()
    if "not ranked" in lower or "unranked" in lower:
        return "Unranked", r
    if "not primarily cs" in lower:
        return "Unranked", r
    if "survey" in lower or "review" in lower:
        return "Unranked", r
    return "Unranked", r

def parse_csv_line(rec):
    if len(rec) < 10:
        return None
    issns = [x.strip() for x in rec[8:12] if x.strip()]
    for_codes = [x.strip() for x in rec[5:8] if x.strip()]
    raw_rank = rec[3].strip()
    rank, note = normalize_core_rank(raw_rank)
    entry = {
        "id": rec[0].strip(),
        "title": rec[1].strip(),
        "source": rec[2].strip(),
        "rank": rank,
        "issns": issns,
        "for_codes": for_codes,
        "rank_history": [{"source": rec[2].strip(), "rank": rank}]
    }
    if note:
        entry["core_note"] = note
    return entry

def fetch_with_retry(session: requests.Session, url: str, max_retries: int = 3, timeout: int = 60) -> str:
    delay = 1
    for attempt in range(max_retries):
        try:
            res = session.get(url, timeout=timeout)
            res.raise_for_status()
            return res.text
        except requests.RequestException as e:
            if attempt == max_retries - 1:
                raise
            time.sleep(delay)
            delay *= 2
    raise RuntimeError(f"Failed to fetch {url} after {max_retries} attempts")

def fetch_and_parse():
    RAW.mkdir(parents=True, exist_ok=True)
    all_journals = {}
    session = requests.Session()
    session.headers.update({"User-Agent": UA})
    if os.path.exists(CA_BUNDLE):
        session.verify = CA_BUNDLE

    for src in SOURCES:
        cache_file = RAW / f"export_{src}.csv"
        if cache_file.exists():
            text = cache_file.read_text(encoding="utf-8")
        else:
            url = f"{BASE}?search=&by=all&source={src}&do=Export"
            text = fetch_with_retry(session, url, max_retries=3, timeout=60)
            cache_file.write_text(text, encoding="utf-8")

        reader = csv.reader(io.StringIO(text))
        header = next(reader, None)
        for row in reader:
            parsed = parse_csv_line(row)
            if not parsed:
                continue
            jid = parsed["id"]
            if jid in all_journals:
                all_journals[jid]["rank_history"].append({"source": src, "rank": parsed["rank"]})
            else:
                all_journals[jid] = parsed

    # Deterministic output
    out_list = sorted(all_journals.values(), key=lambda x: x["id"])
    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(json.dumps(out_list, indent=1))
    return out_list

if __name__ == "__main__":
    journals = fetch_and_parse()
    print(f"Exported {len(journals)} CORE journals -> {OUT}")
