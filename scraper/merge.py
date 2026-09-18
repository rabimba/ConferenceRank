"""Merge CORE + PaperCopilot + lixin + OpenAlex -> src/data/conferences.json"""

import json
import os
import re
from pathlib import Path

D = Path(__file__).parent / "data"
OUT = Path(__file__).parent.parent / "conf-rank" / "src" / "data" / "conferences.json"

# ---- FoR code -> friendly category (ANZSRC 2020 division 46 + CSE) ----
FOR_CATEGORIES = {
    "4601": "Applied Computing",
    "4602": "Artificial Intelligence",
    "4603": "Computer Vision & Multimedia",
    "4604": "Cybersecurity & Privacy",
    "4605": "Data Management & Mining",
    "4606": "Distributed Systems & Networks",
    "4607": "Graphics, VR & Games",
    "4608": "Human-Computer Interaction",
    "4609": "Information Systems",
    "4610": "Library & Information Studies",
    "4611": "Machine Learning",
    "4612": "Software Engineering & PL",
    "4613": "Theory of Computation",
    "4699": "General & Interdisciplinary CS",
    "46": "General & Interdisciplinary CS",
    "CSE": "Hardware & Architecture",
    "0801": "Artificial Intelligence",
    "0802": "Theory of Computation",
    "0803": "Software Engineering & PL",
    "0804": "Data Management & Mining",
    "0805": "Distributed Systems & Networks",
    "0806": "Information Systems",
}

RANK_ORDER = {
    "A*": 1, "A": 2, "B": 3, "Australasian B": 4,
    "C": 5, "Australasian C": 6,
}

SOURCE_YEAR = {
    "ICORE2026": 2026, "CORE2023": 2023, "CORE2021": 2021, "CORE2020": 2020,
    "CORE2018": 2018, "CORE2017": 2017, "CORE2014": 2014, "CORE2013": 2013,
    "ERA2010": 2010, "CORE2008": 2008,
}


def norm_acr(s: str) -> str:
    return re.sub(r"[^a-z0-9]", "", s.lower())


def clean_stats(stats: list[dict]) -> list[dict]:
    """Drop bogus/incomplete year rows so charts and headers stay sane."""
    import datetime
    this_year = datetime.date.today().year
    out = []
    for s in stats:
        y = s.get("year")
        rate = s.get("rate")
        accepted = s.get("accepted")
        submitted = s.get("submitted") or s.get("total")
        tiers = s.get("tiers") or {}
        if y is None or y > this_year:
            continue
        # If rate is present, ensure it's a realistic percentage (workshops can
        # legitimately exceed 60%; only near-100% implies a broken parse).
        if rate is not None and (rate <= 0 or rate >= 95):
            continue
        # We need at least an accepted count (>= 5) or a valid rate
        if accepted is None and rate is None:
            continue
        if accepted is not None and accepted < 5:
            continue
        if submitted and accepted and accepted > submitted:
            continue
        # any tier count greater than accepted => broken parse / incomplete
        if accepted and any(n and n > accepted for n in tiers.values()):
            continue
        out.append(s)
    out.sort(key=lambda r: r["year"])
    return out


def _load_required(name: str):
    path = D / name
    if not path.exists():
        raise FileNotFoundError(f"{name} missing — run its fetcher first")
    try:
        return json.loads(path.read_text())
    except json.JSONDecodeError as e:
        raise SystemExit(f"{name} is corrupt ({e}) — re-run its fetcher") from e


def _atomic_write(path: Path, text: str):
    path.parent.mkdir(parents=True, exist_ok=True)
    tmp = path.with_suffix(".tmp")
    tmp.write_text(text)
    os.replace(tmp, path)


def merge():
    core = _load_required("core.json")
    pc = _load_required("papercopilot.json")
    lixin = _load_required("lixin.json")
    try:
        manual = json.loads((D / "manual_stats.json").read_text())
    except FileNotFoundError:
        print("manual_stats.json missing (optional)")
        manual = {}
    try:
        oa = json.loads((D / "openalex.json").read_text())
    except FileNotFoundError:
        print("openalex.json missing (optional)")
        oa = {}
    try:
        deadlines = json.loads((D / "deadlines.json").read_text())
    except FileNotFoundError:
        print("deadlines.json missing (optional)")
        deadlines = {}

    pc_by_acr = {}
    for slug, recs in pc.items():
        # slug like 'neurips', 'acmmm', 'siggraph-asia', '3dv'
        normed = norm_acr(slug)
        pc_by_acr[normed] = recs
        if normed == "siggraphasia":
            pc_by_acr["siggrapha"] = recs

    lixin_by_acr = {norm_acr(k): v for k, v in lixin.items()}
    manual_by_acr = {norm_acr(k): v for k, v in manual.items()}

    # acronym aliases: source-key -> CORE acronym (normed)
    ALIASES = {
        "oakland": "sp", "ieeep": "sp",
        "www": "thewebconf",
        "naacl": "naaclhlt",
        "siggrapha": "siggraphasia",
        "acmsiggraph": "siggraph",
        "sigkdd": "kdd",
        "wisec": "acmwisec",
    }

    def aliased(table: dict, acr: str) -> list[dict] | None:
        """Lookup acr in table, following aliases in both directions."""
        hit = table.get(acr)
        if hit:
            return hit
        for src, dst in ALIASES.items():
            other = dst if acr == src else src if acr == dst else None
            if other:
                hit = table.get(other)
                if hit:
                    return hit
        return None

    def as_float(x):
        try:
            return float(x)
        except (TypeError, ValueError):
            return None

    out = []
    for v in core:
        acr = norm_acr(v.get("acronym", ""))
        rec = {
            "id": v["id"],
            "title": v["title"],
            "acronym": v.get("acronym", ""),
            "rank": v.get("rank", ""),
            "for_codes": v.get("for_codes", []),
            "categories": sorted({FOR_CATEGORIES.get(c, "Other") for c in v.get("for_codes", [])}),
            "dblp_url": v.get("dblp_url"),
            "avg_rating": as_float(v.get("avg_rating")),
            "rank_history": [
                {
                    "source": h["source"],
                    "year": SOURCE_YEAR.get(h["source"]),
                    "rank": h["rank"],
                    "for": h.get("for"),
                }
                for h in v.get("rank_history", [])
            ],
        }

        # Multi-tier acceptance stats:
        # Priority per year: manual (highest/curated) > lixin > papercopilot
        ms = aliased(manual_by_acr, acr)
        lx = aliased(lixin_by_acr, acr)
        pc_stats = aliased(pc_by_acr, acr)

        # Combine by year with priority: manual > lixin > pc
        by_year = {}
        sources_used = set()

        if pc_stats:
            for s in pc_stats:
                if s.get("year"):
                    by_year[s["year"]] = s
            if by_year:
                sources_used.add("papercopilot")

        if lx:
            rows = [s for s in lx if s.get("year")]
            for s in rows:
                by_year[s["year"]] = s
            if rows:
                sources_used.add("lixin4ever")

        if ms:
            rows = [s for s in ms if s.get("year")]
            for s in rows:
                by_year[s["year"]] = s
            if rows:
                sources_used.add("csconferences/ccf")

        if by_year:
            all_stats = sorted(by_year.values(), key=lambda r: r["year"])
            rec["stats"] = clean_stats(all_stats) or None
            rec["stats_source"] = "+".join(sorted(sources_used)) if rec["stats"] else None
        else:
            rec["stats"] = None
            rec["stats_source"] = None

        oa_data = oa.get(v["id"])
        if oa_data:
            rec["openalex"] = {
                "source_ids": oa_data["source_ids"],
                "works_per_year": oa_data["works_per_year"],
                "topics": oa_data["topics"],
                "topics_by_year": oa_data["topics_by_year"],
                "institutions": oa_data["institutions"],
            }

        rec["deadlines"] = deadlines.get(v["id"])
        out.append(rec)

    # sanity
    n_stats = sum(1 for r in out if r["stats"])
    n_oa = sum(1 for r in out if r.get("openalex"))
    n_ddl = sum(1 for r in out if r.get("deadlines"))
    n_hist = sum(1 for r in out if r["rank_history"])
    print(f"venues: {len(out)} | with stats: {n_stats} | with openalex: {n_oa} | with deadlines: {n_ddl} | with rank history: {n_hist}")

    core_acrs = {norm_acr(v.get("acronym", "")) for v in core}
    core_acrs |= set(ALIASES.values()) | set(ALIASES.keys())
    for label, table in (("papercopilot", pc_by_acr), ("lixin", lixin_by_acr), ("manual", manual_by_acr)):
        missing = sorted(k for k in table if k not in core_acrs)
        if missing:
            print(f"unmatched {label} keys: {', '.join(missing)}")

    _atomic_write(OUT, json.dumps(out, separators=(",", ":")))
    print(f"wrote -> {OUT} ({OUT.stat().st_size // 1024} KB)")

    # search index for VenueLookup (lazy-fetched): id/acronym/title/rank only
    PUBLIC = Path(__file__).parent.parent / "conf-rank" / "public"
    PUBLIC.mkdir(parents=True, exist_ok=True)
    search_idx = [
        {"id": r["id"], "acronym": r["acronym"], "title": r["title"], "rank": r["rank"]}
        for r in out
    ]
    _atomic_write(PUBLIC / "search-index.json", json.dumps(search_idx, separators=(",", ":")))
    print(f"wrote -> public/search-index.json ({(PUBLIC / 'search-index.json').stat().st_size // 1024} KB)")

    # slim directory list for the home table: fields needed to render rows + filter
    def latest_rate(r):
        if not r["stats"]:
            return None
        for s in sorted(r["stats"], key=lambda x: x["year"], reverse=True):
            rate = s.get("rate")
            if rate and 0 < rate < 60:
                return round(rate, 2)
        return None

    def latest_accepted(r):
        if not r["stats"]:
            return None
        s = max(r["stats"], key=lambda x: x["year"])
        return s.get("accepted")

    slim = [
        {
            "id": r["id"],
            "acronym": r["acronym"],
            "title": r["title"],
            "rank": r["rank"],
            "categories": r["categories"],
            "has_stats": bool(r["stats"]),
            "latest_rate": latest_rate(r),
            "latest_accepted": latest_accepted(r),
        }
        for r in out
    ]
    slim_path = Path(__file__).parent / "data" / "directory.json"
    _atomic_write(slim_path, json.dumps(slim, separators=(",", ":")))
    print(f"wrote -> data/directory.json ({slim_path.stat().st_size // 1024} KB)")


if __name__ == "__main__":
    merge()
