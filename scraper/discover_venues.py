"""Discover newly announced CS conferences not yet in the CORE universe.

Harvest candidates from OpenReview venue group ids + conference-deadlines
entries that fail CORE resolution, verify each against DBLP / OpenAlex
(proof the venue is real, not a one-page workshop site or predatory listing),
and merge into scraper/data/discovered_venues.json (existing entries are
never dropped unless denylisted in blocked_venues.json).

Run: python3 discover_venues.py [--dry-run]
"""

import argparse
import json
import os
import re
import sys
import time
from difflib import SequenceMatcher
from pathlib import Path

import requests

from venue_match import DEFAULT_CATEGORY, acr_from_group_id, area_to_categories, norm_acr, resolve_venue
import fetch_deadlines as fd

D = Path(__file__).parent / "data"
OUT = D / "discovered_venues.json"
BLOCKED = D / "blocked_venues.json"
VERIFY_CACHE = D / "discover_verify_cache.json"  # id -> evidence token | null (committed)
CA = os.environ.get("PROXY_CA", "/usr/local/etc/openssl/certs/paypal_proxy_cacerts.pem")

OPENREVIEW_API = "https://api2.openreview.net"
OR_CONF_RE = re.compile(r"^(?P<org>.+?)/20(?:2[5-9])/Conference$")


class VerifyTransient(Exception):
    """Network/rate-limit failure — verdict unknown, retry next run."""

session = requests.Session()
session.headers.update({"User-Agent": "ConferenceRank/1.0 (+https://github.com/rabimba/ranking)"})
if os.path.exists(CA):
    session.verify = CA


def _ratio(a: str, b: str) -> float:
    return SequenceMatcher(None, norm_acr(a), norm_acr(b)).ratio()


def openreview_candidate(gid: str) -> dict | None:
    """'AAAI.org/2027/Conference' -> {'id': 'or-aaai', 'acronym': 'AAAI', ...}."""
    acr = acr_from_group_id(gid)
    if not acr or len(norm_acr(acr)) < 2:
        return None
    return {
        "id": f"or-{norm_acr(acr)}",
        "acronym": acr,
        "title": acr,
        "dblp": None,
        "website": None,
        "evidence": [f"openreview:{gid}"],
        "areas": [],
    }


def load_blocked(path: Path = BLOCKED) -> list[str]:
    if not path.exists():
        return []
    try:
        rows = json.loads(path.read_text(encoding="utf-8"))
    except json.JSONDecodeError:
        return []
    return [norm_acr(r.get("acronym", "")) for r in rows if r.get("acronym")]


def _openreview_group_ok(gid: str, cand: dict) -> str | None:
    """Fetch an OpenReview venue group; a real conference has a website + PC."""
    try:
        r = session.get(f"{OPENREVIEW_API}/groups", params={"id": gid}, timeout=30)
        if r.status_code == 429:
            time.sleep(45)
            r = session.get(f"{OPENREVIEW_API}/groups", params={"id": gid}, timeout=30)
        r.raise_for_status()
        groups = r.json().get("groups") or []
        if not groups:
            return None
        content = groups[0].get("content") or {}
        website = (content.get("website") or {}).get("value")
        has_pc = bool((content.get("program_chairs_id") or {}).get("value"))
        if not (website and has_pc):
            return None
        cand["website"] = website
        full_title = (content.get("title") or {}).get("value")
        if full_title:
            cand["title"] = full_title
        return f"openreview-verified:{gid}"
    except requests.RequestException as e:
        print(f"Warning: OpenReview verify {gid}: {e}", file=sys.stderr)
        raise VerifyTransient(gid) from e


def _dblp_openalex_verify(candidate: dict) -> str | None:
    """Opportunistic external verification; network failures are transient (retry next run)."""
    acr = candidate.get("acronym", "")
    title = candidate.get("title", "")
    try:
        r = session.get("https://dblp.org/search/venue/api",
                        params={"q": acr, "format": "json"}, timeout=30)
        r.raise_for_status()
        hits = (r.json().get("result", {}).get("hits", {}).get("hit") or [])
        for hit in hits:
            info = hit.get("info", {})
            name = info.get("venue") or info.get("title") or ""
            if isinstance(name, list):
                name = " ".join(name)
            if _ratio(acr, name) >= 0.6:
                url = info.get("url") or ""
                m = re.search(r"dblp\.org/db/(conf|journals)/([^/?#]+)/?$", url)
                slug = m.group(2) if m else ""
                return f"dblp:{slug or norm_acr(acr)}"
    except requests.RequestException as e:
        print(f"Warning: DBLP verify {acr}: {e}", file=sys.stderr)
        raise VerifyTransient(acr) from e
    except (KeyError, ValueError) as e:
        # bot-check pages / malformed JSON -> treat as transient too
        print(f"Warning: DBLP verify {acr}: {e}", file=sys.stderr)
        raise VerifyTransient(acr) from e
    try:
        r = session.get("https://api.openalex.org/sources",
                        params={"search": title or acr, "filter": "type:conference",
                                "mailto": "icore.conference.ranks@gmail.com"}, timeout=30)
        r.raise_for_status()
        for src in r.json().get("results", [])[:3]:
            if _ratio(title or acr, src.get("display_name", "")) >= 0.75:
                return f"openalex:{src.get('id', '').rsplit('/', 1)[-1]}"
    except requests.RequestException as e:
        print(f"Warning: OpenAlex verify {acr}: {e}", file=sys.stderr)
        raise VerifyTransient(acr) from e
    return None


def _default_verify(candidate: dict) -> str | None:
    """Verify a candidate venue is real.

    Primary signals (no external API needed):
    - OpenReview main-Conference group with a website + program chairs
    - curated-feed membership (ccfddl / sec-deadlines / conference-deadlines)
    Optional: DBLP / OpenAlex when reachable (they block some networks).
    """
    for ev in candidate.get("evidence", []):
        if ev.startswith("openreview:") and "/Conference" in ev:
            gid = ev.split("openreview:", 1)[1]
            tok = _openreview_group_ok(gid, candidate)
            if tok:
                return tok
            break  # group checked but not verified — not a network failure
        if ev.startswith(("ccf:", "sec-deadlines:", "conference-deadlines:")):
            return f"feed-curated:{ev.split(':', 1)[0]}"
    return _dblp_openalex_verify(candidate)


def discover(candidates, blocked, existing, verify_fn) -> list[dict]:
    blocked_set = set()
    for b in blocked:
        raw = b.get("acronym", "") if isinstance(b, dict) else b
        if raw:
            blocked_set.add(norm_acr(raw))
    by_id = {v["id"]: dict(v) for v in existing}

    for cand in candidates:
        acr = norm_acr(cand.get("acronym", ""))
        if len(acr) < 2 or acr in blocked_set:
            continue
        title = cand.get("title") or cand.get("acronym", "")
        # workshops are not conference venues
        if title.strip().lower().startswith("workshop"):
            continue
        if cand["id"] in by_id:
            # union evidence
            merged = by_id[cand["id"]]
            for ev in cand.get("evidence", []):
                if ev not in merged.get("evidence", []):
                    merged.setdefault("evidence", []).append(ev)
            for field in ("title", "website", "dblp"):
                if not merged.get(field) and cand.get(field):
                    merged[field] = cand[field]
                elif (field == "dblp" and isinstance(cand.get(field), str) and cand["dblp"].startswith("http")
                      and isinstance(merged.get("dblp"), str) and not merged["dblp"].startswith("http")):
                    merged["dblp"] = cand["dblp"]  # upgrade bare slug to full URL
            if cand.get("areas"):
                cats = sorted(set(merged.get("categories") or []) |
                              set(area_to_categories(cand["areas"])))
                if len(cats) > 1:
                    cats = [c for c in cats if c != DEFAULT_CATEGORY]
                merged["categories"] = cats
            continue
        evidence = verify_fn(cand)
        if not evidence:
            print(f"discover: unverified, dropped: {cand['id']}")
            continue
        rec = {
            "id": cand["id"],
            "title": cand.get("title") or cand.get("acronym", ""),
            "acronym": cand.get("acronym", ""),
            "rank": "Unranked",
            "for_codes": [],
            "categories": area_to_categories(cand.get("areas") or []),
            "dblp_url": cand.get("dblp"),
            "website": cand.get("website"),
            "evidence": list(cand.get("evidence", [])) + [evidence],
            "emerging": True,
        }
        by_id[cand["id"]] = rec

    # the denylist also removes already-admitted venues (the removal mechanism)
    return [
        dict(v, evidence=sorted(v.get("evidence", [])))
        for k, v in sorted(by_id.items())
        if norm_acr(v.get("acronym", "")) not in blocked_set
        and len(norm_acr(v.get("acronym", ""))) >= 2
        and not (v.get("title") or "").strip().lower().startswith("workshop")
    ]


def _absorb_into_emerging(venue: dict, areas: list[str], dblp: str | None = None):
    """A feed entry resolved to an already-discovered (emerging) venue:
    enrich its categories and dblp_url in place (entry carries info OpenReview lacks)."""
    if areas:
        cats = sorted(set(venue.get("categories") or []) | set(area_to_categories(areas)))
        if len(cats) > 1:
            cats = [c for c in cats if c != DEFAULT_CATEGORY]
        venue["categories"] = cats
    if dblp and dblp.startswith("http") and venue.get("dblp_url") and not venue["dblp_url"].startswith("http"):
        venue["dblp_url"] = dblp


def _harvest(core, extra) -> list[dict]:
    candidates: list[dict] = []

    # OpenReview main-conference groups for recent years
    try:
        r = session.get(f"{OPENREVIEW_API}/groups?id=venues", timeout=60)
        r.raise_for_status()
        members = r.json()["groups"][0]["members"]
        for gid in members:
            cand = openreview_candidate(gid)
            if not cand:
                continue
            if resolve_venue(cand["acronym"], cand["acronym"], None, core, extra):
                continue  # belongs to the CORE deadline pipeline
            cand["evidence"].append(f"openreview-year:{gid}")
            candidates.append(cand)
    except Exception as e:
        print(f"Warning: OpenReview harvest failed: {e}", file=sys.stderr)

    # Feed entries that failed CORE resolution but carry a real link
    try:
        entries = fd.run_adapters([fd.fetch_ccfddl, fd.fetch_confdeadlines, fd.fetch_sec])
        by_cid: dict[str, dict] = {}
        for e in entries:
            title, acr, dblp = e.get("title", ""), e.get("acronym", ""), e.get("dblp")
            hit = resolve_venue(title, acr, dblp, core, extra)
            if hit:
                if hit.get("emerging"):
                    _absorb_into_emerging(hit, e.get("areas") or [], dblp)
                continue  # belongs to the CORE/emerging deadline pipeline
            # ccfddl sometimes stores the bare DBLP slug ("dblp: mlsys")
            if dblp and not dblp.startswith("http"):
                dblp = f"https://dblp.org/db/conf/{dblp.strip().lower()}"
            slug = ""
            if dblp:
                m = re.search(r"dblp\.org/(?:db/)?conf/([^/?#]+)/?$", dblp)
                slug = m.group(1).lower() if m else ""
            cid = f"dblp-{slug}" if slug else (f"pc-{norm_acr(acr)}" if norm_acr(acr) else "")
            if not cid:
                continue
            if not (dblp or e.get("cfp_url")):
                continue
            src = e.get("source", "")
            areas = set(e.get("areas") or [])
            if cid in by_cid:
                # same venue seen again: keep the richest identity, union areas/evidence
                prev = by_cid[cid]
                prev["areas"] = sorted(set(prev["areas"]) | areas)
                if len(title) > len(prev["title"]):
                    prev["title"] = title
                tag = f"{src}:{acr}"
                if tag not in prev["evidence"]:
                    prev["evidence"].append(tag)
                continue
            by_cid[cid] = {
                "id": cid, "acronym": acr, "title": title, "dblp": dblp,
                "website": e.get("cfp_url"),
                "evidence": [f"{src}:{acr}"],
                "areas": sorted(areas),
            }
        candidates.extend(by_cid.values())
    except Exception as e:
        print(f"Warning: feed harvest failed: {e}", file=sys.stderr)

    return candidates


def _atomic_write_text(path: Path, text: str):
    path.parent.mkdir(parents=True, exist_ok=True)
    tmp = path.with_suffix(".tmp")
    tmp.write_text(text, encoding="utf-8")
    os.replace(tmp, path)


def _verify_with_cache(candidates, verify_fn, budget: int = 0) -> dict[str, str | None]:
    """verify each uncached candidate; persist verdicts so CI only pays once.

    budget = max network verifications this run (0 = unlimited). Verdicts from
    cheap/curated checks don't count. Transient failures retry next run.
    """
    cache: dict = {}
    if VERIFY_CACHE.exists():
        try:
            cache = json.loads(VERIFY_CACHE.read_text(encoding="utf-8"))
        except json.JSONDecodeError:
            cache = {}

    def save():
        _atomic_write_text(VERIFY_CACHE, json.dumps(dict(sorted(cache.items())), indent=2))

    out: dict[str, str | None] = {}
    pending = [c for c in candidates if c["id"] not in cache]
    for c in candidates:
        if c["id"] in cache:
            out[c["id"]] = cache[c["id"]]
    used = 0
    checked = 0
    for cand in pending:
        cid = cand["id"]
        is_free = any(ev.startswith(("ccf:", "sec-deadlines:", "conference-deadlines:"))
                      for ev in cand.get("evidence", []))
        if not is_free and budget and used >= budget:
            out[cid] = None  # deferred to a later run; retried, not cached
            continue
        try:
            out[cid] = verify_fn(cand)
        except VerifyTransient:
            out[cid] = None  # unknown verdict — retried next run, not cached
            continue
        cache[cid] = out[cid]
        if not is_free:
            used += 1
        checked += 1
        if checked % 25 == 0:
            save()
        time.sleep(1.0)
    save()
    print(f"verify: {checked} checked this run ({used} network), "
          f"{len(cache)} cached total, {len(pending) - checked} deferred", flush=True)
    return out


def main(dry_run: bool = False, verify_budget: int = 0):
    core = json.loads((D / "core.json").read_text(encoding="utf-8"))
    extra = []
    if OUT.exists():
        extra = json.loads(OUT.read_text(encoding="utf-8"))
    existing_ids = {v["id"] for v in extra}
    # already-discovered venues are part of the resolution universe (no re-harvest)
    resolved_universe_extra = [v for v in extra]

    candidates = _harvest(core, resolved_universe_extra)
    # cheap curated-feed verdicts first; network verifications after
    candidates.sort(key=lambda c: 0 if any(
        ev.startswith(("ccf:", "sec-deadlines:", "conference-deadlines:"))
        for ev in c.get("evidence", [])) else 1)
    new_count = sum(1 for c in candidates if c["id"] not in existing_ids)
    print(f"harvested {len(candidates)} candidates ({new_count} new)", flush=True)

    verdicts = _verify_with_cache(candidates, _default_verify, budget=verify_budget)

    def cached_verify(cand):
        return verdicts.get(cand["id"])

    merged = discover(candidates, load_blocked(), extra, cached_verify)
    new = [v for v in merged if v["id"] not in existing_ids]
    print(f"discovered {len(new)} new verified venues -> {len(merged)} total emerging")

    if not dry_run:
        _atomic_write_text(OUT, json.dumps(merged, indent=2))
    for v in new:
        print(f"  new: {v['id']} ({v['acronym']}) via {v['evidence']}")
    return merged


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--dry-run", action="store_true")
    parser.add_argument("--verify-budget", type=int, default=0,
                        help="max network verifications this run (0 = unlimited)")
    args = parser.parse_args()
    main(dry_run=args.dry_run, verify_budget=args.verify_budget)
