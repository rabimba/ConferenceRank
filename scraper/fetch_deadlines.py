"""Fetch computer science conference deadlines from open repositories.

Sources:
1. CCF-Deadlines (GitHub ccfddl/ccf-deadlines): Systems, AI, DB, Net, Sec, Theory, Graphics, HCI
   (+ its accept_rates/*.yml -> data/ccf_accept_rates.json)
2. Conference-Deadlines (conference-deadlines.github.io): broad CORE-tagged CS coverage
3. SEC-Deadlines (sec-deadlines.github.io): Cybersecurity, Privacy, Cryptography
4. OpenReview API v2: exact submission/abstract deadlines for matched venues

Venues are matched through scraper/venue_match.py (DBLP slug -> alias/override ->
rank-aware fuzzy title), covering CORE plus discovered (emerging) venues.

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
      "source": "ccf" | "conference-deadlines" | "sec-deadlines" | "openreview"
    }
  ]
}

Deterministic: keys sorted, entries sorted by (year, paper_deadline, cycle).
"""

import json
import os
import re
import sys
import time
import zipfile
from datetime import datetime, timedelta
from pathlib import Path

import requests
import yaml

from venue_match import acr_from_group_id, norm_acr, resolve_venue

D = Path(__file__).parent / "data"
RAW = D / "raw" / "deadlines"
OUT = D / "deadlines.json"
RATES_OUT = D / "ccf_accept_rates.json"
CA = os.environ.get("PROXY_CA", "/usr/local/etc/openssl/certs/paypal_proxy_cacerts.pem")

session = requests.Session()
session.headers.update({"User-Agent": "ConferenceRank/1.0 (+https://github.com/rabimba/ranking)"})
if os.path.exists(CA):
    session.verify = CA
else:
    import urllib3
    urllib3.disable_warnings()
    session.verify = False

# Keep deadlines for the current and previous year (older cycles are noise).
MIN_YEAR = datetime.now().year - 1

# Dedup priority when the same deadline appears in multiple sources.
SOURCE_PRIORITY = {"ccf": 0, "conference-deadlines": 1, "sec-deadlines": 2, "openreview": 3}

OPENREVIEW_API = "https://api2.openreview.net"
OR_DATE_RE = re.compile(
    r"(Abstract Registration|Submission Deadline):\s*"
    r"([A-Z][a-z]{2} \d{1,2} \d{4} \d{1,2}:\d{2}(?:AM|PM)?)"
    r"(?:\s*(UTC[+-]\d{1,2}(?::\d{2})?))?"
)


def clean_deadline_str(val):
    if not val or not isinstance(val, (str, int, float)):
        return None
    val_str = str(val).strip()
    if val_str.upper() in ("TBD", "TBA", "NONE", "", "N/A"):
        return None
    return val_str


def _parse_deadline_date(s):
    """Best-effort parse of deadline strings (ISO or 'May 1, 2026' style)."""
    if not s:
        return None
    s = str(s).strip()
    for fmt in ("%Y-%m-%d %H:%M:%S", "%Y-%m-%d %H:%M", "%Y-%m-%d",
                "%B %d, %Y %H:%M", "%B %d, %Y", "%b %d, %Y"):
        try:
            return datetime.strptime(s[:24], fmt)
        except ValueError:
            continue
    try:
        return datetime.fromisoformat(s)
    except ValueError:
        return None


def _iso(dt: datetime) -> str:
    return dt.strftime("%Y-%m-%d %H:%M:%S")


# ---------------------------------------------------------------- adapters --
# Each adapter returns a flat list of deadline entries:
# {title, acronym, dblp, year, cycle, abstract_deadline, paper_deadline,
#  notification_date, timezone, location, conference_dates, cfp_url, source, areas}


def fetch_ccfddl() -> list[dict]:
    RAW.mkdir(parents=True, exist_ok=True)
    zip_path = RAW / "ccf_deadlines.zip"

    if not zip_path.exists() or (datetime.now().timestamp() - zip_path.stat().st_mtime > 86400 * 3):
        print("Fetching ccf-deadlines repository archive...")
        r = session.get("https://github.com/ccfddl/ccf-deadlines/archive/refs/heads/main.zip", timeout=60)
        r.raise_for_status()
        tmp = zip_path.with_suffix(".tmp")
        tmp.write_bytes(r.content)
        os.replace(tmp, zip_path)

    entries: list[dict] = []
    try:
        z = zipfile.ZipFile(zip_path)
    except zipfile.BadZipFile:
        print("Warning: ccf-deadlines zip corrupt; refetching...")
        zip_path.unlink(missing_ok=True)
        r = session.get("https://github.com/ccfddl/ccf-deadlines/archive/refs/heads/main.zip", timeout=60)
        r.raise_for_status()
        zip_path.write_bytes(r.content)
        z = zipfile.ZipFile(zip_path)

    for name in z.namelist():
        if "/conference/" not in name or not name.endswith(".yml"):
            continue
        try:
            docs = yaml.safe_load(z.read(name).decode("utf-8"))
        except Exception:
            continue
        if not docs or not isinstance(docs, list):
            continue
        for conf in docs:
            acr = conf.get("title", "")
            full_title = conf.get("description", "") or acr
            dblp = conf.get("dblp") or None
            areas = conf.get("areas") or []
            for c in conf.get("confs", []):
                year = c.get("year")
                if not year or not isinstance(year, int) or year < MIN_YEAR:
                    continue
                tz = c.get("timezone", "AoE")
                base = {
                    "title": full_title, "acronym": acr, "dblp": dblp, "year": year,
                    "timezone": tz, "location": c.get("place") or None,
                    "conference_dates": c.get("date") or None,
                    "cfp_url": c.get("link") or None,
                    "source": "ccf", "areas": areas,
                }
                for t in c.get("timeline", []):
                    ddl = clean_deadline_str(t.get("deadline"))
                    if not ddl:
                        continue
                    e = dict(base)
                    e.update({
                        "cycle": t.get("comment") or None,
                        "abstract_deadline": clean_deadline_str(t.get("abstract_deadline")),
                        "paper_deadline": ddl,
                        "notification_date": None,
                    })
                    entries.append(e)
    return entries


def fetch_confdeadlines() -> list[dict]:
    url = ("https://raw.githubusercontent.com/conference-deadlines/"
           "conference-deadlines.github.io/main/_data/conferences.yml")
    r = session.get(url, timeout=60)
    r.raise_for_status()
    docs = yaml.safe_load(r.text)
    if not docs or not isinstance(docs, list):
        return []

    entries: list[dict] = []
    for c in docs:
        year = c.get("year")
        if not year or not isinstance(year, int) or year < MIN_YEAR:
            continue
        rows = c.get("deadlines") or []
        if isinstance(rows, dict):
            rows = [rows]
        base = {
            "title": c.get("description", "") or c.get("name", ""),
            "acronym": c.get("name", ""), "dblp": c.get("dblp") or None, "year": year,
            "timezone": "UTC", "location": c.get("place") or None,
            "conference_dates": c.get("date") or None,
            "cfp_url": c.get("link") or None,
            "source": "conference-deadlines", "areas": c.get("areas") or [],
        }
        for i, row in enumerate(rows):
            ddl_raw = clean_deadline_str(row.get("date"))
            if not ddl_raw:
                continue
            try:
                ddl = _iso(datetime.fromisoformat(str(ddl_raw)))
            except ValueError:
                continue
            abs_raw = clean_deadline_str(row.get("abstract"))
            abstract = None
            if abs_raw:
                try:
                    abstract = _iso(datetime.fromisoformat(str(abs_raw)))
                except ValueError:
                    abstract = None
            comment = clean_deadline_str(row.get("comment"))
            e = dict(base)
            e.update({
                "cycle": comment if (comment and len(comment) < 60) else None,
                "abstract_deadline": abstract,
                "paper_deadline": ddl,
                "notification_date": None,
            })
            entries.append(e)
    return entries


def fetch_sec() -> list[dict]:
    url = "https://raw.githubusercontent.com/sec-deadlines/sec-deadlines.github.io/master/_data/conferences.yml"
    r = session.get(url, timeout=60)
    r.raise_for_status()
    docs = yaml.safe_load(r.text)
    if not docs or not isinstance(docs, list):
        return []

    entries: list[dict] = []
    for c in docs:
        year = c.get("year")
        if not year or not isinstance(year, int) or year < MIN_YEAR:
            continue
        deadlines = c.get("deadline", [])
        if isinstance(deadlines, (str, int, float)):
            deadlines = [deadlines]
        base = {
            "title": c.get("description", "") or c.get("name", ""),
            "acronym": re.sub(r"\(.*?\)", "", c.get("name", "")).strip(),
            "dblp": None, "year": year,
            "timezone": c.get("timezone", "AoE"),
            "location": c.get("place") or None,
            "conference_dates": c.get("date") or None,
            "cfp_url": c.get("link") or None,
            "source": "sec-deadlines", "areas": [],
        }
        for i, d in enumerate(deadlines):
            ddl = clean_deadline_str(d)
            if not ddl or "%" in ddl:
                continue
            e = dict(base)
            e.update({
                "cycle": f"Cycle {i+1}" if len(deadlines) > 1 else None,
                "abstract_deadline": None,
                "paper_deadline": ddl,
                "notification_date": None,
            })
            entries.append(e)
    return entries


def _parse_or_date_str(m: re.Match) -> dict | None:
    label, when, tz = m.group(1), m.group(2), m.group(3)
    for fmt in ("%b %d %Y %I:%M%p", "%b %d %Y %I:%M"):
        try:
            dt = datetime.strptime(when, fmt)
        except ValueError:
            continue
        if tz:
            offset = tz.replace("UTC", "")
            try:
                sign = 1 if offset.startswith("+") else -1
                hh, mm = (offset[1:].split(":") + ["00"])[:2]
                dt -= sign * timedelta(hours=int(hh), minutes=int(mm))
            except (ValueError, IndexError):
                pass
        return {"label": label, "iso": _iso(dt)}
    return None


def fetch_openreview(core, extra_venues) -> list[dict]:
    r = session.get(f"{OPENREVIEW_API}/groups?id=venues", timeout=60)
    r.raise_for_status()
    members = r.json()["groups"][0]["members"]

    universe = list(core) + (extra_venues or [])
    matched: dict[str, dict] = {}  # group id -> venue
    for gid in members:
        org = acr_from_group_id(gid)
        if not org:
            continue
        v = resolve_venue(org, org, None, universe)
        if v:
            matched[gid] = v

    or_raw = RAW / "openreview"
    or_raw.mkdir(parents=True, exist_ok=True)

    def group_content(gid: str) -> dict | None:
        """Group content with 7-day file cache (avoids ~400 daily re-fetches)."""
        safe = re.sub(r"[^A-Za-z0-9_.-]+", "_", gid)
        p = or_raw / f"{safe}.json"
        if p.exists() and not os.environ.get("FORCE_FETCH") \
                and time.time() - p.stat().st_mtime < 7 * 86400:
            try:
                return json.loads(p.read_text(encoding="utf-8"))
            except json.JSONDecodeError:
                pass
        gr = session.get(f"{OPENREVIEW_API}/groups", params={"id": gid}, timeout=30)
        if gr.status_code == 429:
            time.sleep(45)
            gr = session.get(f"{OPENREVIEW_API}/groups", params={"id": gid}, timeout=30)
        gr.raise_for_status()
        content = gr.json()["groups"][0]["content"]
        tmp = p.with_suffix(".tmp")
        tmp.write_text(json.dumps(content), encoding="utf-8")
        os.replace(tmp, p)
        time.sleep(0.3)
        return content

    entries: list[dict] = []
    for gid, venue in sorted(matched.items()):
        try:
            content = group_content(gid)
        except Exception as e:
            print(f"Warning: OpenReview group {gid}: {e}", file=sys.stderr)
            continue
        if content is None:
            continue
        date_blob = (content.get("date") or {}).get("value") or ""
        parsed = {}
        for m in OR_DATE_RE.finditer(date_blob):
            row = _parse_or_date_str(m)
            if row:
                parsed[row["label"]] = row["iso"]
        ddl = parsed.get("Submission Deadline")
        if not ddl:
            continue
        ym = re.search(r"/(20(?:2[5-9]))/Conference$", gid)
        year = int(ym.group(1))
        entries.append({
            "title": venue.get("title", ""), "acronym": venue.get("acronym", ""),
            "dblp": venue.get("dblp_url"), "year": year,
            "cycle": None,
            "abstract_deadline": parsed.get("Abstract Registration"),
            "paper_deadline": ddl,
            "notification_date": None,
            "timezone": "UTC",
            "location": (content.get("location") or {}).get("value"),
            "conference_dates": (content.get("start_date") or {}).get("value"),
            "cfp_url": (content.get("website") or {}).get("value"),
            "source": "openreview", "areas": [],
        })
        print(f"openreview: {gid} -> {venue['id']} (deadline {ddl})")
    return entries


def run_adapters(adapters) -> list[dict]:
    """Run source adapters; a failing source degrades to [] with a warning."""
    out: list[dict] = []
    for adapter in adapters:
        try:
            out.extend(adapter())
        except Exception as e:
            print(f"Warning: deadline source {getattr(adapter, '__name__', adapter)} failed: {e}",
                  file=sys.stderr)
    return out


# ------------------------------------------------------------------ build --


def build_deadlines(core, extra_venues, entries) -> dict:
    by_vid: dict[str, list[dict]] = {}
    memo: dict[tuple, dict | None] = {}

    # Deterministic dedup: process entries in source-priority order.
    for e in sorted(entries, key=lambda x: SOURCE_PRIORITY.get(x.get("source"), 9)):
        if not e.get("year") or e["year"] < MIN_YEAR:
            continue
        key = (e.get("title", ""), e.get("acronym", ""), e.get("dblp"))
        if key not in memo:
            memo[key] = resolve_venue(key[0], key[1], key[2], core, extra_venues)
        venue = memo[key]
        if not venue:
            continue
        by_vid.setdefault(venue["id"], []).append(e)

    merged: dict[str, list[dict]] = {}
    for vid, rows in by_vid.items():
        entries_out: list[dict] = []
        seen: dict[tuple, int] = {}
        for item in rows:
            dt = _parse_deadline_date(item["paper_deadline"])
            key = (item["year"], dt.isoformat() if dt else str(item["paper_deadline"]))
            if key in seen:
                existing = entries_out[seen[key]]
                for field in ("abstract_deadline", "notification_date", "location",
                              "conference_dates", "cfp_url", "cycle"):
                    if not existing.get(field) and item.get(field):
                        existing[field] = item[field]
                continue
            seen[key] = len(entries_out)
            entries_out.append({
                "cycle": item.get("cycle"),
                "year": item["year"],
                "abstract_deadline": item.get("abstract_deadline"),
                "paper_deadline": item["paper_deadline"],
                "notification_date": item.get("notification_date"),
                "timezone": item.get("timezone", "AoE"),
                "location": item.get("location"),
                "conference_dates": item.get("conference_dates"),
                "cfp_url": item.get("cfp_url"),
                "source": item.get("source"),
            })
        merged[vid] = entries_out
    return merged


def canonicalize(merged: dict) -> dict:
    out = {}
    for vid in sorted(merged):
        rows = sorted(merged[vid], key=lambda x: (x["year"], x["paper_deadline"], x.get("cycle") or ""))
        out[vid] = rows
    return out


def collect_accept_rates(zip_path: Path) -> dict[str, list[dict]]:
    """Parse ccf-deadlines accept_rates/*.yml -> {norm_acr: [{year, rate, accepted, submitted}]}."""
    z = zipfile.ZipFile(zip_path)
    out: dict[str, list[dict]] = {}
    for name in z.namelist():
        if "/accept_rates/" not in name or not name.endswith(".yml"):
            continue
        try:
            docs = yaml.safe_load(z.read(name).decode("utf-8"))
        except Exception:
            continue
        if not docs or not isinstance(docs, list):
            continue
        for doc in docs:
            acr = norm_acr(doc.get("title", ""))
            rows = doc.get("accept_rates") or []
            if not acr or not isinstance(rows, list):
                continue
            for row in rows:
                year, accepted, submitted, rate = row.get("year"), row.get("accepted"), row.get("submitted"), row.get("rate")
                if None in (year, accepted, submitted, rate):
                    continue
                out.setdefault(acr, []).append({
                    "year": year,
                    "rate": round(rate * 100, 2) if rate <= 1 else round(rate, 2),
                    "accepted": accepted,
                    "submitted": submitted,
                })
    for acr in out:
        out[acr].sort(key=lambda r: r["year"])
    return dict(sorted(out.items()))


def _atomic_write_text(path: Path, text: str):
    path.parent.mkdir(parents=True, exist_ok=True)
    tmp = path.with_suffix(".tmp")
    tmp.write_text(text, encoding="utf-8")
    os.replace(tmp, path)


def _load_universe():
    core_path = D / "core.json"
    if not core_path.exists():
        core_path = Path(__file__).parent.parent / "conf-rank" / "src" / "data" / "conferences.json"
    core = json.loads(core_path.read_text(encoding="utf-8"))
    extra = []
    discovered_path = D / "discovered_venues.json"
    if discovered_path.exists():
        extra = json.loads(discovered_path.read_text(encoding="utf-8"))
    return core, extra


def main():
    core, extra = _load_universe()
    print(f"Universe: {len(core)} CORE + {len(extra)} discovered venues")

    entries = run_adapters([
        fetch_ccfddl,            # includes zip download needed for accept rates
        fetch_confdeadlines,
        fetch_sec,
    ])
    # OpenReview needs the universe for pre-resolution; tolerate failure.
    try:
        entries.extend(fetch_openreview(core, extra))
    except Exception as e:
        print(f"Warning: OpenReview source failed: {e}", file=sys.stderr)

    merged = canonicalize(build_deadlines(core, extra, entries))
    _atomic_write_text(OUT, json.dumps(merged, indent=2))
    print(f"Wrote {len(merged)} conferences with deadlines to {OUT}")

    # Acceptance rates from ccf-deadlines (tolerated failure).
    zip_path = RAW / "ccf_deadlines.zip"
    if zip_path.exists():
        try:
            rates = collect_accept_rates(zip_path)
            _atomic_write_text(RATES_OUT, json.dumps(rates, indent=2))
            print(f"Wrote {len(rates)} accept-rate rows to {RATES_OUT}")
        except Exception as e:
            print(f"Warning: accept-rates parse failed: {e}", file=sys.stderr)
    return merged


if __name__ == "__main__":
    main()
