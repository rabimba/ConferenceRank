"""Fetch computer science conference deadlines from open repositories.

Sources:
1. CCF-Deadlines (GitHub ccfddl/ccf-deadlines): Systems, AI, DB, Net, Sec, Theory, Graphics, HCI
2. AI-Deadlines (Papers with Code): AI, Machine Learning, Computer Vision, NLP
3. SEC-Deadlines (sec-deadlines): Cybersecurity, Privacy, Cryptography, Software Engineering

Output: scraper/data/deadlines.json
{
  "venue_id": [
    {
      "cycle": "Round 1" | null,
      "year": 2026,
      "abstract_deadline": "2026-07-02 17:00:00" | null,
      "paper_deadline": "2026-07-09 17:00:00",
      "notification_date": "2026-09-15" | null,
      "timezone": "AoE" | "UTC" | string,
      "location": "City, Country" | null,
      "conference_dates": "Month Day-Day, Year" | null,
      "cfp_url": "https://..." | null,
      "source": "ccf" | "ai-deadlines" | "sec-deadlines"
    }
  ]
}
"""

import io
import json
import os
import re
import sys
import zipfile
from pathlib import Path
from datetime import datetime

import requests
import yaml

D = Path(__file__).parent / "data"
RAW = D / "raw" / "deadlines"
OUT = D / "deadlines.json"
CA = os.environ.get("PROXY_CA", "/usr/local/etc/openssl/certs/paypal_proxy_cacerts.pem")

session = requests.Session()
session.headers.update({"User-Agent": "ConferenceRank/1.0 (+https://github.com/rabimba/ranking)"})
if os.path.exists(CA):
    session.verify = CA
else:
    # Disable insecure request warnings when running in local development environments
    import urllib3
    urllib3.disable_warnings()
    session.verify = False


def norm_acr(s: str) -> str:
    """Normalize acronym for fuzzy/alias matching."""
    return re.sub(r"[^a-z0-9]", "", s.lower())


def load_venues_map():
    """Build acronym and title lookups from CORE conferences."""
    core_path = D / "core.json"
    if not core_path.exists():
        # Fallback to conferences.json if core.json is not present
        alt_path = Path(__file__).parent.parent / "conf-rank" / "src" / "data" / "conferences.json"
        if alt_path.exists():
            core_path = alt_path
        else:
            raise FileNotFoundError("Neither core.json nor conferences.json found.")
    venues = json.loads(core_path.read_text(encoding="utf-8"))
    
    by_acr = {}
    by_title = {}
    for v in venues:
        vid = v.get("id")
        acr = norm_acr(v.get("acronym", ""))
        title = norm_acr(v.get("title", ""))
        if acr:
            by_acr[acr] = v
        if title:
            by_title[title] = v
    return by_acr, by_title


def clean_deadline_str(val):
    if not val or not isinstance(val, (str, int, float)):
        return None
    val_str = str(val).strip()
    if val_str.upper() in ("TBD", "TBA", "NONE", "", "N/A"):
        return None
    return val_str


def parse_ccf_deadlines(by_acr, by_title):
    """Download and parse CCF deadlines archive."""
    RAW.mkdir(parents=True, exist_ok=True)
    zip_path = RAW / "ccf_deadlines.zip"
    
    if not zip_path.exists() or (datetime.now().timestamp() - zip_path.stat().st_mtime > 86400 * 3):
        print("Fetching ccf-deadlines repository archive...")
        try:
            r = session.get("https://github.com/ccfddl/ccf-deadlines/archive/refs/heads/main.zip", timeout=60)
            r.raise_for_status()
            zip_path.write_bytes(r.content)
        except Exception as e:
            print(f"Warning: Failed to fetch ccf-deadlines archive: {e}")
            if not zip_path.exists():
                return {}

    z = zipfile.ZipFile(zip_path)
    res = {}

    for name in z.namelist():
        if "/conference/" in name and name.endswith(".yml"):
            try:
                content = z.read(name).decode("utf-8")
                docs = yaml.safe_load(content)
            except Exception:
                continue
            if not docs or not isinstance(docs, list):
                continue
            for conf in docs:
                title = conf.get("title", "")
                desc = conf.get("description", "")
                venue = by_acr.get(norm_acr(title)) or by_title.get(norm_acr(desc))
                if not venue:
                    continue
                vid = venue["id"]
                if vid not in res:
                    res[vid] = []

                for c in conf.get("confs", []):
                    year = c.get("year")
                    if not year or not isinstance(year, int) or year < 2024:
                        continue
                    timeline = c.get("timeline", [])
                    tz = c.get("timezone", "AoE")
                    place = c.get("place", "")
                    conf_dates = c.get("date", "")
                    link = c.get("link", "")
                    for t in timeline:
                        ddl = clean_deadline_str(t.get("deadline"))
                        if not ddl:
                            continue
                        abstract_ddl = clean_deadline_str(t.get("abstract_deadline"))
                        res[vid].append({
                            "cycle": t.get("comment") or None,
                            "year": year,
                            "abstract_deadline": abstract_ddl,
                            "paper_deadline": ddl,
                            "notification_date": None,
                            "timezone": tz,
                            "location": place or None,
                            "conference_dates": conf_dates or None,
                            "cfp_url": link or None,
                            "source": "ccf"
                        })
    return res


def parse_ai_deadlines(by_acr, by_title):
    """Fetch and parse paperswithcode ai-deadlines."""
    url = "https://raw.githubusercontent.com/paperswithcode/ai-deadlines/gh-pages/_data/conferences.yml"
    print("Fetching ai-deadlines...")
    try:
        r = session.get(url, timeout=30)
        r.raise_for_status()
        docs = yaml.safe_load(r.text)
    except Exception as e:
        print(f"Warning: Failed to fetch ai-deadlines: {e}")
        return {}

    if not docs or not isinstance(docs, list):
        return {}

    res = {}
    for c in docs:
        title = c.get("title", "")
        full_name = c.get("full_name", "")
        venue = by_acr.get(norm_acr(title)) or by_title.get(norm_acr(full_name))
        if not venue:
            continue
        vid = venue["id"]
        if vid not in res:
            res[vid] = []

        year = c.get("year")
        if not year or not isinstance(year, int) or year < 2024:
            continue

        ddl = clean_deadline_str(c.get("deadline"))
        if not ddl:
            continue

        abstract_ddl = clean_deadline_str(c.get("abstract_deadline"))
        tz = c.get("timezone", "AoE")
        place = c.get("place", "")
        conf_dates = c.get("date", "")
        link = c.get("link", "")
        note = c.get("note", "")

        res[vid].append({
            "cycle": note if (note and len(note) < 40) else None,
            "year": year,
            "abstract_deadline": abstract_ddl,
            "paper_deadline": ddl,
            "notification_date": None,
            "timezone": tz,
            "location": place or None,
            "conference_dates": conf_dates or None,
            "cfp_url": link or None,
            "source": "ai-deadlines"
        })
    return res


def parse_sec_deadlines(by_acr, by_title):
    """Fetch and parse sec-deadlines."""
    url = "https://raw.githubusercontent.com/sec-deadlines/sec-deadlines.github.io/master/_data/conferences.yml"
    print("Fetching sec-deadlines...")
    try:
        r = session.get(url, timeout=30)
        r.raise_for_status()
        docs = yaml.safe_load(r.text)
    except Exception as e:
        print(f"Warning: Failed to fetch sec-deadlines: {e}")
        return {}

    if not docs or not isinstance(docs, list):
        return {}

    res = {}
    for c in docs:
        name = c.get("name", "")
        desc = c.get("description", "")
        # Handle formats like "S&P (Oakland)" -> SP
        clean_name = re.sub(r"\(.*?\)", "", name).strip()
        venue = by_acr.get(norm_acr(clean_name)) or by_title.get(norm_acr(desc))
        if not venue:
            continue
        vid = venue["id"]
        if vid not in res:
            res[vid] = []

        year = c.get("year")
        if not year or not isinstance(year, int) or year < 2024:
            continue

        deadlines = c.get("deadline", [])
        if isinstance(deadlines, (str, int, float)):
            deadlines = [deadlines]

        tz = c.get("timezone", "AoE")
        place = c.get("place", "")
        conf_dates = c.get("date", "")
        link = c.get("link", "")
        comment = c.get("comment", "")

        for i, d in enumerate(deadlines):
            ddl = clean_deadline_str(d)
            if not ddl or "%" in ddl: # skip placeholders like "%Y-05-31"
                continue
            cycle_label = f"Cycle {i+1}" if len(deadlines) > 1 else None
            res[vid].append({
                "cycle": cycle_label,
                "year": year,
                "abstract_deadline": None,
                "paper_deadline": ddl,
                "notification_date": None,
                "timezone": tz,
                "location": place or None,
                "conference_dates": conf_dates or None,
                "cfp_url": link or None,
                "source": "sec-deadlines"
            })
    return res


def merge_deadlines():
    by_acr, by_title = load_venues_map()
    print(f"Loaded {len(by_acr)} venues for deadline mapping.")

    ccf = parse_ccf_deadlines(by_acr, by_title)
    ai = parse_ai_deadlines(by_acr, by_title)
    sec = parse_sec_deadlines(by_acr, by_title)

    all_vids = set(ccf.keys()) | set(ai.keys()) | set(sec.keys())
    merged = {}

    for vid in all_vids:
        entries = []
        seen = set()
        
        # Priority: sec / ai / ccf
        for item in (sec.get(vid, []) + ai.get(vid, []) + ccf.get(vid, [])):
            key = (item["year"], item["paper_deadline"][:10])
            if key in seen:
                continue
            seen.add(key)
            entries.append(item)

        # Sort entries chronologically by paper_deadline
        entries.sort(key=lambda x: str(x["paper_deadline"]))
        if entries:
            merged[vid] = entries

    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(json.dumps(merged, indent=2), encoding="utf-8")
    print(f"Wrote {len(merged)} conferences with deadlines to {OUT}")
    return merged


if __name__ == "__main__":
    merge_deadlines()
