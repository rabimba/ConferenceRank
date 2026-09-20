import csv
import io
import json
import os
from pathlib import Path
import requests

CA_BUNDLE = os.environ.get("PROXY_CA", "/usr/local/etc/openssl/certs/paypal_proxy_cacerts.pem")

BASE = "https://portal.core.edu.au/jnl-ranks/"
SOURCES = ["CORE2020", "ERA2010"]
RAW = Path(__file__).parent / "data" / "raw" / "core_journals"
OUT = Path(__file__).parent / "data" / "core_journals.json"
UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) conf-rank-scraper/1.0"

def parse_csv_line(rec):
    if len(rec) < 10:
        return None
    issns = [x.strip() for x in rec[8:12] if x.strip()]
    for_codes = [x.strip() for x in rec[5:8] if x.strip()]
    return {
        "id": rec[0].strip(),
        "title": rec[1].strip(),
        "source": rec[2].strip(),
        "rank": rec[3].strip(),
        "issns": issns,
        "for_codes": for_codes,
        "rank_history": [{"source": rec[2].strip(), "rank": rec[3].strip()}]
    }

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
            res = session.get(url, timeout=30)
            res.raise_for_status()
            text = res.text
            cache_file.write_text(text, encoding="utf-8")

        reader = csv.reader(io.StringIO(text))
        next(reader, None)  # header
        for row in reader:
            parsed = parse_csv_line(row)
            if not parsed:
                continue
            jid = parsed["id"]
            if jid in all_journals:
                # Add to rank history if from previous era
                all_journals[jid]["rank_history"].append({"source": src, "rank": parsed["rank"]})
            else:
                all_journals[jid] = parsed

    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(json.dumps(list(all_journals.values()), indent=1))
    return list(all_journals.values())

if __name__ == "__main__":
    journals = fetch_and_parse()
    print(f"Exported {len(journals)} CORE journals -> {OUT}")
