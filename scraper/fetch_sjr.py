import csv
import json
import os
import shutil
import time
from pathlib import Path
import requests

from issn_utils import split_and_clean_issns

SJR_CSV_URL = "https://raw.githubusercontent.com/Michael-E-Rose/SCImagoJournalRankIndicators/master/all.csv"
RAW_FILE = Path(__file__).parent / "data" / "raw" / "sjr_all.csv"
OUT = Path(__file__).parent / "data" / "sjr.json"

CACHED_RAW_FILE = Path(os.environ.get("SJR_RAW_CSV", "")) if os.environ.get("SJR_RAW_CSV") else None

# CS (17) + 7 Pure Science ASJC fields:
# 13: Biochemistry, Genetics & Molecular Biology
# 16: Chemistry
# 17: Computer Science
# 20: Earth & Planetary Sciences
# 26: Materials Science
# 28: Neuroscience
# 31: Physics & Astronomy
# 36: Mathematics
ALL_FIELD_PREFIXES = ("13", "16", "17", "20", "26", "28", "31", "36")
CS_FIELD_PREFIXES = ALL_FIELD_PREFIXES

def compute_quartile_thresholds(field_scores: dict[tuple[str, int], list[float]]) -> dict[tuple[str, int], tuple[float, float, float]]:
    """
    Given {(field, year): [scores]}, calculate (q1_cutoff, q2_cutoff, q3_cutoff)
    where Q1 is top 25% (score >= q1_cutoff), etc.
    """
    thresholds = {}
    for key, scores in field_scores.items():
        if not scores:
            continue
        sorted_s = sorted(scores)
        n = len(sorted_s)
        # Percentile rank (higher score = better rank)
        # 75th percentile score = Q1 threshold
        # 50th percentile score = Q2 threshold
        # 25th percentile score = Q3 threshold
        idx_75 = int(n * 0.75)
        idx_50 = int(n * 0.50)
        idx_25 = int(n * 0.25)
        q1 = sorted_s[idx_75]
        q2 = sorted_s[idx_50]
        q3 = sorted_s[idx_25]
        thresholds[key] = (q1, q2, q3)
    return thresholds

def score_to_quartile(score: float | None, cutoffs: tuple[float, float, float] | None) -> str | None:
    if score is None or cutoffs is None:
        return None
    q1, q2, q3 = cutoffs
    if score >= q1:
        return "Q1"
    elif score >= q2:
        return "Q2"
    elif score >= q3:
        return "Q3"
    else:
        return "Q4"

QUARTILE_ORDER = {"Q1": 1, "Q2": 2, "Q3": 3, "Q4": 4}

def best_quartile(q1: str | None, q2: str | None) -> str | None:
    if not q1:
        return q2
    if not q2:
        return q1
    return q1 if QUARTILE_ORDER.get(q1, 5) <= QUARTILE_ORDER.get(q2, 5) else q2

def fetch_and_parse_sjr(allowed_prefixes: tuple[str, ...] = CS_FIELD_PREFIXES):
    RAW_FILE.parent.mkdir(parents=True, exist_ok=True)
    if not RAW_FILE.exists():
        if CACHED_RAW_FILE and CACHED_RAW_FILE.exists():
            print(f"Copying cached {CACHED_RAW_FILE} to {RAW_FILE}...")
            shutil.copy(CACHED_RAW_FILE, RAW_FILE)
        else:
            print(f"Downloading {SJR_CSV_URL}...")
            delay = 1
            max_retries = 3
            downloaded = False
            for attempt in range(max_retries):
                try:
                    r = requests.get(SJR_CSV_URL, stream=True, timeout=60)
                    r.raise_for_status()
                    with open(RAW_FILE, "wb") as f:
                        for chunk in r.iter_content(chunk_size=65536):
                            f.write(chunk)
                    downloaded = True
                    break
                except requests.RequestException as e:
                    if attempt == max_retries - 1:
                        raise
                    time.sleep(delay)
                    delay *= 2
            if not downloaded:
                raise RuntimeError("Failed to download SJR CSV")

    print(f"Pass 1: Gathering field scores for percentile/quartile calculation...")
    field_scores: dict[tuple[str, int], list[float]] = {}
    with open(RAW_FILE, "r", encoding="utf-8", errors="ignore") as f:
        reader = csv.DictReader(f)
        for row in reader:
            fld = row.get("field", "").strip()
            if not any(fld.startswith(p) for p in allowed_prefixes):
                continue
            year_str = row.get("year", "").strip()
            if not year_str.isdigit():
                continue
            year = int(year_str)
            sjr_str = row.get("SJR", "").strip()
            if sjr_str:
                try:
                    sjr_val = float(sjr_str)
                    key = (fld, year)
                    if key not in field_scores:
                        field_scores[key] = []
                    field_scores[key].append(sjr_val)
                except ValueError:
                    pass

    thresholds = compute_quartile_thresholds(field_scores)

    print("Pass 2: Parsing SJR journals...")
    journals = {}
    with open(RAW_FILE, "r", encoding="utf-8", errors="ignore") as f:
        reader = csv.DictReader(f)
        for row in reader:
            fld = row.get("field", "").strip()
            if not any(fld.startswith(p) for p in allowed_prefixes):
                continue
            title = row.get("Title", "").strip()
            if not title:
                continue
            year_str = row.get("year", "").strip()
            if not year_str.isdigit():
                continue
            year = int(year_str)
            sjr_str = row.get("SJR", "").strip()
            sjr = None
            if sjr_str:
                try:
                    sjr = float(sjr_str)
                except ValueError:
                    sjr = None

            h_index_str = row.get("h-index", "").strip()
            h_index = None
            if h_index_str:
                try:
                    h_index = int(h_index_str)
                except ValueError:
                    h_index = None

            raw_issn = row.get("Issn", "")
            issns = split_and_clean_issns(raw_issn)

            # Determine quartile for this field & year
            cutoffs = thresholds.get((fld, year))
            q = score_to_quartile(sjr, cutoffs)

            if title not in journals:
                journals[title] = {
                    "title": title,
                    "issns": set(),
                    "fields": set(),
                    "history": {}
                }
            journals[title]["fields"].add(fld)
            for i in issns:
                journals[title]["issns"].add(i)

            if year not in journals[title]["history"]:
                journals[title]["history"][year] = {
                    "year": year,
                    "sjr": sjr,
                    "quartile": q,
                    "h_index": h_index
                }
            else:
                # If journal listed under multiple fields, keep best quartile and valid score
                prev = journals[title]["history"][year]
                if prev["sjr"] is None and sjr is not None:
                    prev["sjr"] = sjr
                if prev["h_index"] is None and h_index is not None:
                    prev["h_index"] = h_index
                prev["quartile"] = best_quartile(prev["quartile"], q)

    # Aggregate summaries
    out_list = []
    for title in sorted(journals.keys()):
        data = journals[title]
        hist = sorted(data["history"].values(), key=lambda x: x["year"])

        # Latest non-null SJR year for latest_score and latest_quartile
        valid_sjr_hist = [h for h in hist if h["sjr"] is not None]
        latest_valid = valid_sjr_hist[-1] if valid_sjr_hist else (hist[-1] if hist else {})

        # Latest h_index can come from latest entry
        latest_entry = hist[-1] if hist else {}

        out_list.append({
            "title": title,
            "issns": sorted(data["issns"]),
            "fields": sorted(data["fields"]),
            "latest_score": latest_valid.get("sjr"),
            "latest_quartile": latest_valid.get("quartile"),
            "latest_h_index": latest_entry.get("h_index") or latest_valid.get("h_index"),
            "history": hist
        })

    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(json.dumps(out_list, indent=1))
    print(f"Parsed {len(out_list)} journals from SJR -> {OUT}")
    return out_list

if __name__ == "__main__":
    fetch_and_parse_sjr()
