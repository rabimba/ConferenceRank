import csv
import json
import os
import re
import shutil
from pathlib import Path
import requests

SJR_CSV_URL = "https://raw.githubusercontent.com/Michael-E-Rose/SCImagoJournalRankIndicators/master/all.csv"
RAW_FILE = Path(__file__).parent / "data" / "raw" / "sjr_all.csv"
OUT = Path(__file__).parent / "data" / "sjr.json"

CACHED_RAW_FILE = Path("/var/folders/6v/d2458d5j3r78w9tm_hqcl05h0000gp/T/opencode/sjr_all.csv")

def clean_issn(s):
    return re.sub(r"[^0-9X]", "", s.upper())

def fetch_and_parse_sjr():
    RAW_FILE.parent.mkdir(parents=True, exist_ok=True)
    if not RAW_FILE.exists():
        if CACHED_RAW_FILE.exists():
            print(f"Copying cached {CACHED_RAW_FILE} to {RAW_FILE}...")
            shutil.copy(CACHED_RAW_FILE, RAW_FILE)
        else:
            print(f"Downloading {SJR_CSV_URL}...")
            r = requests.get(SJR_CSV_URL, stream=True)
            r.raise_for_status()
            with open(RAW_FILE, "wb") as f:
                for chunk in r.iter_content(chunk_size=65536):
                    f.write(chunk)

    print("Parsing SJR CS journals...")
    journals = {}
    with open(RAW_FILE, "r", encoding="utf-8", errors="ignore") as f:
        reader = csv.DictReader(f)
        for row in reader:
            # CS field code starts with 17
            field = row.get("field", "")
            if not field.startswith("17"):
                continue
            title = row.get("Title", "").strip()
            if not title:
                continue
            year = int(row.get("year", 0))
            sjr_str = row.get("SJR", "").strip()
            sjr = float(sjr_str) if sjr_str else None
            h_index = int(row.get("h-index", 0)) if row.get("h-index") else None
            issn = clean_issn(row.get("Issn", ""))

            if title not in journals:
                journals[title] = {
                    "title": title,
                    "issns": set(),
                    "history": {}
                }
            if issn:
                journals[title]["issns"].add(issn)
            journals[title]["history"][year] = {
                "year": year,
                "sjr": sjr,
                "h_index": h_index
            }

    # Aggregate summaries
    out_list = []
    for title, data in journals.items():
        hist = sorted(data["history"].values(), key=lambda x: x["year"])
        latest = hist[-1] if hist else {}
        out_list.append({
            "title": title,
            "issns": list(data["issns"]),
            "latest_score": latest.get("sjr"),
            "latest_h_index": latest.get("h_index"),
            "history": hist
        })

    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(json.dumps(out_list, indent=1))
    print(f"Parsed {len(out_list)} CS journals from SJR -> {OUT}")
    return out_list

if __name__ == "__main__":
    fetch_and_parse_sjr()
