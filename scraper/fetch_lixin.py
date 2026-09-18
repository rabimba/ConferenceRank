"""Fetch acceptance-rate history from lixin4ever/Conference-Acceptance-Rate README.

Format: |CONF'YY | 26.2% (146/572) | 26.1% (139/551) |  (long, short)

Output: scraper/data/lixin.json
{ACRONYM: [{year, rate, accepted, submitted, note}]}
"""

import json
import os
import re
import time
from datetime import date
from pathlib import Path

import requests

URL = "https://raw.githubusercontent.com/lixin4ever/Conference-Acceptance-Rate/master/README.md"
RAW = Path(__file__).parent / "data" / "raw" / "lixin_readme.md"
OUT = Path(__file__).parent / "data" / "lixin.json"
CA = os.environ.get("PROXY_CA", "/usr/local/etc/openssl/certs/paypal_proxy_cacerts.pem")

ROW = re.compile(r"^\|\s*([A-Za-z][A-Za-z0-9&@ .+\-/']*)\s*(?:'(\d{2}))?\s*\|(.*)\|\s*$")
CELL = re.compile(r"([\d.]+)%\s*\(([\d,]+)/([\d,]+|\?[\d,.]*)\)")

session = requests.Session()
if os.path.exists(CA):
    session.verify = CA


def main():
    RAW.parent.mkdir(parents=True, exist_ok=True)
    if RAW.exists():
        text = RAW.read_text()
    else:
        for attempt in range(3):
            try:
                r = session.get(URL, timeout=60, headers={"User-Agent": "Mozilla/5.0"})
                r.raise_for_status()
                break
            except requests.RequestException:
                if attempt == 2:
                    raise
                time.sleep(2 * (attempt + 1))
        text = r.text
        RAW.write_text(text)

    result: dict[str, list] = {}
    for line in text.splitlines():
        m = ROW.match(line.strip())
        if not m:
            continue
        name, yy, rest = m.groups()
        # name cell may embed year: ACL'14
        nm = re.match(r"^\s*([A-Za-z][A-Za-z0-9&@ .+\-/']*?)\s*'(\d{2})\s*$", name)
        if nm:
            name, yy = nm.group(1), nm.group(2)
        if not yy:
            continue
        # Two-digit year pivot relative to current year (no hardcoded 30 cutoff).
        century = 2000 if int(yy) <= date.today().year % 100 + 1 else 1900
        year = century + int(yy)
        acronym = name.strip().upper().replace(" ", "")
        cells = CELL.findall(rest)
        if not cells:
            # still record year without data
            continue
        rec = {"year": year}
        rate, acc, sub = cells[0]
        rec["rate"] = float(rate)
        rec["accepted"] = int(acc.replace(",", ""))
        if sub.replace(",", "").isdigit():
            rec["submitted"] = int(sub.replace(",", ""))
        # long+short: combine if both exist
        if len(cells) > 1:
            r2, a2, s2 = cells[1]
            rec["rate_short"] = float(r2)
            rec["accepted_short"] = int(a2.replace(",", ""))
            if s2.replace(",", "").isdigit():
                rec["submitted_short"] = int(s2.replace(",", ""))
        # trailing note (orals/posters breakdown etc)
        note = re.sub(r"[\d.]+%\s*\([\d/?]+\)|[|]", " ", rest).strip(" -")
        note = re.sub(r"\s{2,}", " ", note)
        if note and len(note) < 100 and note != "-":
            rec["note"] = note
        result.setdefault(acronym, []).append(rec)

    for v in result.values():
        v.sort(key=lambda r: r["year"])

    OUT.parent.mkdir(parents=True, exist_ok=True)
    tmp = OUT.with_suffix(".tmp")
    tmp.write_text(json.dumps(result, indent=1))
    os.replace(tmp, OUT)
    print(f"Wrote {len(result)} acronyms -> {OUT}")
    for k in list(result)[:8]:
        print(" ", k, [r["year"] for r in result[k]][:12])


if __name__ == "__main__":
    main()
