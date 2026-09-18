"""Fetch PaperCopilot per-year conference statistics.

Index: /statistics/ -> venue links
Venue page: /statistics/{venue}-statistics/ -> year rows with
Total / Accept (n, pct) / tier breakdown / Reject / Location

Output: scraper/data/papercopilot.json
{acronym: [{year, total, accepted, rate, tiers: {name: n}, reject, location}]}
"""

import json
import os
import re
import time
from pathlib import Path

import requests

BASE = "https://papercopilot.com"
RAW = Path(__file__).parent / "data" / "raw" / "papercopilot"
OUT = Path(__file__).parent / "data" / "papercopilot.json"
CA = os.environ.get("PROXY_CA", "/usr/local/etc/openssl/certs/paypal_proxy_cacerts.pem")
DELAY = 1.0

session = requests.Session()
session.headers.update({"User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36"})
if os.path.exists(CA):
    session.verify = CA


def cached_get(url: str, name: str) -> str:
    RAW.mkdir(parents=True, exist_ok=True)
    path = RAW / name
    if path.exists():
        return path.read_text(encoding="utf-8")
    last_err = None
    for attempt in range(3):
        try:
            r = session.get(url, timeout=60)
            if r.status_code == 429:
                retry_after = int(r.headers.get("Retry-After", "5"))
                time.sleep(min(retry_after, 60))
                continue
            r.raise_for_status()
            path.write_text(r.text, encoding="utf-8")
            time.sleep(DELAY)
            return r.text
        except requests.RequestException as e:
            last_err = e
            time.sleep(2 * (attempt + 1))
    raise last_err


TIER_LABEL_RE = re.compile(r'data-summary-tier-label="([^"]+)"')
NUM_CELL_RE = re.compile(r"^\s*([\d,.]+)(?:\s*\(([\d.]+)%\))?\s*$")


def parse_venue_full(html: str) -> list[dict]:
    """Parse venue stats table, supporting both modern data-summary-key and legacy formats."""
    # Check if modern data-summary-key exists
    has_modern = 'data-summary-key="accept"' in html
    out = []
    rows = re.findall(r"<tr[^>]*>(.*?)</tr>", html, re.S)

    if has_modern:
        for r in rows:
            ym = re.search(r"-(\d{4})-statistics", r)
            if not ym:
                continue
            year = int(ym.group(1))
            cells = re.findall(r"<td([^>]*)>(.*?)</td>", r, re.S)
            key_data = {}
            for attrs, val in cells:
                km = re.search(r'data-summary-key="([^"]+)"', attrs)
                rawm = re.search(r'data-summary-raw="([^"]*)"', attrs)
                if km:
                    k = km.group(1)
                    raw = rawm.group(1) if rawm else ""
                    key_data[k] = (raw, val)

            if "accept" in key_data:
                raw_acc, val_acc = key_data["accept"]
                try:
                    acc = int(float(raw_acc)) if raw_acc else None
                except ValueError:
                    acc = None

                # Rate from accept cell e.g. 3218 (26.07%)
                pct_m = re.search(r"\(([\d.]+)%\)", val_acc)
                rate = float(pct_m.group(1)) if pct_m else None

                tot = None
                if "total" in key_data:
                    raw_tot, _ = key_data["total"]
                    try:
                        tot = int(float(raw_tot)) if raw_tot else None
                    except ValueError:
                        tot = None

                if not tot and acc and rate and rate > 0:
                    tot = round(acc * 100.0 / rate)
                elif tot and acc and not rate and tot > 0:
                    rate = round(acc * 100.0 / tot, 2)

                if acc or tot:
                    rec = {"year": year, "tiers": {}}
                    if acc:
                        rec["accepted"] = acc
                    if tot:
                        rec["total"] = tot
                    if rate:
                        rec["rate"] = rate

                    if "location" in key_data:
                        loc = re.sub(r"<[^>]+>", "", key_data["location"][1]).strip()
                        if loc and loc != "-" and len(loc) < 100:
                            rec["location"] = loc

                    for k, (t_raw, _) in key_data.items():
                        if k.startswith("tier_"):
                            t_name = k.removeprefix("tier_").capitalize()
                            try:
                                count = int(float(t_raw))
                                if count > 0:
                                    rec["tiers"][t_name] = count
                            except ValueError:
                                pass
                    out.append(rec)
        out.sort(key=lambda r: r["year"])
        return out

    tier_names = TIER_LABEL_RE.findall(html)
    for row in rows:
        ym = re.search(r"-(\d{4})-statistics", row)
        if not ym:
            continue
        year = int(ym.group(1))
        cells = re.findall(r"<td[^>]*>(.*?)</td>", row, re.S)
        if len(cells) < 3:
            continue
        # numeric cells with optional pct, in document order, skipping empties
        vals = []
        for c in cells:
            t = strip_tags(c)
            nm = NUM_CELL_RE.match(t)
            if nm:
                vals.append((int(nm.group(1).replace(",", "")),
                             float(nm.group(2)) if nm.group(2) else None))
        # Non-empty numeric cells map to: [total?, accept, tier1..tierN, reject]
        # total present iff first cell has no pct AND second has pct.
        if len(vals) < 2:
            continue
        idx = 0
        total = None
        if vals[0][1] is None and vals[1][1] is not None:
            total = vals[0][0]
            idx = 1
        if idx >= len(vals) or vals[idx][1] is None:
            continue
        rec = {"year": year, "tiers": {}}
        rec["accepted"], rec["rate"] = vals[idx]
        if rec["rate"] and rec["rate"] > 0:
            rec["total"] = total if total else round(rec["accepted"] * 100.0 / rec["rate"])
        elif total:
            rec["total"] = total
        else:
            # 0% rate with no total column — cannot derive; skip row rather than crash
            continue
        rest = vals[idx + 1:]
        n_tiers = max(len(tier_names) - 1, 0)
        tier_vals = rest[:n_tiers] if n_tiers else []
        reject_val = rest[n_tiers] if n_tiers and len(rest) > n_tiers else None
        for (n, _), name in zip(tier_vals, tier_names):
            rec["tiers"][name] = n
        if reject_val:
            rec["reject"] = reject_val[0]
        for c in cells:
            t = strip_tags(c)
            if "," in t and any(ch.isalpha() for ch in t) and not NUM_CELL_RE.match(t) \
               and "statistics" not in c and t not in ("", "Pages", "Loading..."):
                rec["location"] = t
                break
        out.append(rec)
    out.sort(key=lambda r: r["year"])
    return out
LINK_RE = re.compile(r'href="(https://papercopilot\.com/statistics/[a-z0-9-]+-statistics/)"[^>]*>\s*<[^>]*>?([^<]*)')


def strip_tags(s: str) -> str:
    s = re.sub(r"<[^>]+>", "|", s)
    s = re.sub(r"&nbsp;", " ", s)
    s = re.sub(r"\s+", " ", s)
    for part in s.split("|"):
        part = part.strip()
        if part and not part.startswith(("min:", "max:", "avg:", "std:")):
            return part
    return ""



def main():
    print("Fetching index...")
    idx_html = cached_get(f"{BASE}/statistics/", "index.html")
    links = sorted(set(LINK_RE.findall(idx_html)))
    # dedupe by url
    urls = {}
    for url, _ in links:
        slug = url.rsplit("/statistics/", 1)[1].removesuffix("-statistics/")
        if slug and slug != "":
            urls[slug] = url
    # filter pagination/other links
    urls = {s: f"{BASE}/statistics/{s}-statistics/" for s in urls if re.match(r"^[a-z0-9-]+$", s)}
    print(f"Venues found: {len(urls)}")

    result = {}
    for i, (slug, url) in enumerate(sorted(urls.items()), 1):
        try:
            html = cached_get(url, f"{slug}.html")
            recs = parse_venue_full(html)
        except Exception as e:
            print(f"  ! {slug}: {e}")
            continue
        if recs:
            result[slug] = recs
        if i % 10 == 0:
            print(f"  {i}/{len(urls)} ({len(result)} with data)")

    OUT.parent.mkdir(parents=True, exist_ok=True)
    tmp = OUT.with_suffix(".tmp")
    tmp.write_text(json.dumps(result, indent=1))
    os.replace(tmp, OUT)
    print(f"Wrote {len(result)} venues -> {OUT}")


if __name__ == "__main__":
    main()
