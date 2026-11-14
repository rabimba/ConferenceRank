"""Shared venue resolver: match upstream CFP/stats sources to CORE venues.

Tier 1: DBLP venue slug (dblp.org/db/conf/{slug}) exact match.
Tier 2: explicit OVERRIDES (source name -> CORE id), then ALIASES-normalized
        unique acronym match across core + extra venues.
Tier 3: fuzzy normalized-title match (ratio >= 0.8), rank-aware tie-break.
"""

import re
from difflib import SequenceMatcher

# community acronym -> CORE acronym (normalized); ported from merge.py
ALIASES: dict[str, str] = {
    "oakland": "sp",
    "ieeep": "sp",
    "www": "thewebconf",
    "naacl": "naaclhlt",
    "siggrapha": "siggraphasia",
    "acmsiggraph": "siggraph",
    "sigkdd": "kdd",
    "wisec": "acmwisec",
}

# upstream source name (normalized) -> CORE numeric id, for names acronyms alone cannot disambiguate
OVERRIDES: dict[str, str] = {
    "sigkdd": "26",
    "acmsiggraph": "38",
    "ieeevr": "758",
    "siggraphasia": "957",
    "sigopsatc": "44",
    "ec": "14",
    "fse": "52",
    "hri": "2310",
}

AREA_TO_CATEGORY = {
    "AI": "Artificial Intelligence",
    "CG": "Computer Vision & Multimedia",
    "CT": "Theory of Computation",
    "DB": "Data Management & Mining",
    "DS": "Distributed Systems & Networks",
    "HI": "Human-Computer Interaction",
    "MX": "General & Interdisciplinary CS",
    "NW": "Distributed Systems & Networks",
    "SC": "Cybersecurity & Privacy",
    "SE": "Software Engineering & PL",
}

DEFAULT_CATEGORY = "General & Interdisciplinary CS"

_RANK_ORDER = {"A*": 0, "A": 1, "B": 2, "C": 3}


def norm_acr(s: str) -> str:
    return re.sub(r"[^a-z0-9]", "", s.lower())


def area_to_categories(areas: list[str]) -> list[str]:
    if not areas:
        return [DEFAULT_CATEGORY]
    return sorted({AREA_TO_CATEGORY.get(a, DEFAULT_CATEGORY) for a in areas})


def _dblp_slug(url: str) -> str:
    if not url:
        return ""
    m = re.search(r"dblp\.org/(?:db/)?conf/([^/?#]+)/?$", url.strip().rstrip("/"))
    if m:
        return m.group(1).lower()
    # ccfddl sometimes stores the bare DBLP slug ("dblp: mlsys")
    s = url.strip().rstrip("/").lower()
    return s if re.fullmatch(r"[a-z0-9][a-z0-9\-.]*", s) else ""


def _venue_slug(v: dict) -> str:
    url = v.get("dblp_url") or ""
    return _dblp_slug(url) if url else ""


def _rank_key(v: dict) -> int:
    return _RANK_ORDER.get(v.get("rank", ""), 9)


def _acr_key(v: dict) -> str:
    return norm_acr(v.get("acronym", ""))


def resolve_venue(
    title: str,
    acronym: str,
    dblp_url: str | None,
    core: list[dict],
    extra_venues: list[dict] | None = None,
) -> dict | None:
    universe = list(core) + (extra_venues or [])

    # Tier 1: DBLP slug
    if dblp_url:
        slug = _dblp_slug(dblp_url)
        if slug:
            hits = [v for v in universe if _venue_slug(v) == slug]
            if len(hits) == 1:
                return hits[0]

    acr = norm_acr(acronym)

    # Tier 2a: explicit overrides (highest priority for known collisions)
    if acr and acr in OVERRIDES:
        by_id = {v["id"]: v for v in universe}
        if acr in OVERRIDES and OVERRIDES[acr] in by_id:
            return by_id[OVERRIDES[acr]]

    # Tier 2b: alias-normalized acronym
    lookups = [acr]
    if acr:
        if acr in ALIASES:
            lookups.append(ALIASES[acr])
        lookups += [src for src, dst in ALIASES.items() if dst == acr]

    for lookup in lookups:
        if not lookup:
            continue
        hits = [v for v in universe if _acr_key(v) == lookup]
        if len(hits) == 1:
            return hits[0]

    # Tier 3: fuzzy title match, rank-aware tie-break
    norm_title = norm_acr(title)
    if norm_title:
        scored = []
        for v in universe:
            ratio = SequenceMatcher(None, norm_title, norm_acr(v.get("title", ""))).ratio()
            if ratio >= 0.8:
                scored.append((ratio, -_rank_key(v), v))
        if scored:
            scored.sort(key=lambda t: (t[0], t[1]), reverse=True)
            return scored[0][2]

    return None
