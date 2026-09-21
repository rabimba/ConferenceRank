import json
import re
from pathlib import Path

from issn_utils import split_and_clean_issns, format_issn

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
    "0801": "Artificial Intelligence",
    "0802": "Theory of Computation",
    "0803": "Software Engineering & PL",
    "0804": "Data Management & Mining",
    "0805": "Distributed Systems & Networks",
    "0806": "Information Systems",
}

# ASJC 2-digit field prefixes to human readable names
ASJC_FIELD_NAMES = {
    "13": "Biochemistry, Genetics & Molecular Biology",
    "16": "Chemistry",
    "17": "Computer Science",
    "20": "Earth & Planetary Sciences",
    "26": "Materials Science",
    "28": "Neuroscience",
    "31": "Physics & Astronomy",
    "36": "Mathematics",
}

def slugify(title: str) -> str:
    s = title.lower()
    s = re.sub(r"[^a-z0-9]+", "-", s).strip("-")
    return s[:80]

def normalize_title(t: str) -> str:
    return re.sub(r"[^a-z0-9]+", "", (t or "").lower())

def deduplicate_slug(slug: str, used_slugs: set[str], disambiguator: str | None = None) -> str:
    if slug not in used_slugs:
        used_slugs.add(slug)
        return slug
    # If collision, try with disambiguator (e.g. first ISSN)
    if disambiguator:
        candidate = f"{slug}-{disambiguator.lower()}"[:80]
        if candidate not in used_slugs:
            used_slugs.add(candidate)
            return candidate
    # Fallback to suffix -2, -3...
    i = 2
    while True:
        candidate = f"{slug}-{i}"[:80]
        if candidate not in used_slugs:
            used_slugs.add(candidate)
            return candidate
        i += 1

def build_journal_record(jid: str, core_item: dict | None, sjr_item: dict | None, openalex_item: dict | None = None) -> dict:
    title = (core_item or {}).get("title") or (sjr_item or {}).get("title")
    issns = set()
    if core_item:
        for i in core_item.get("issns", []):
            for ci in split_and_clean_issns(i):
                issns.add(format_issn(ci))
    if sjr_item:
        for i in sjr_item.get("issns", []):
            for ci in split_and_clean_issns(i):
                issns.add(format_issn(ci))

    categories = []
    if core_item:
        for fc in core_item.get("for_codes", []):
            if fc in FOR_CATEGORIES:
                cat = FOR_CATEGORIES[fc]
                if cat not in categories:
                    categories.append(cat)

    if sjr_item:
        for fld in sjr_item.get("fields", []):
            prefix = fld[:2]
            name = ASJC_FIELD_NAMES.get(prefix)
            if name and name not in categories:
                categories.append(name)

    if not categories:
        categories = ["General & Interdisciplinary CS"]

    sjr_data = None
    if sjr_item:
        sjr_data = {
            "latest_score": sjr_item.get("latest_score"),
            "latest_quartile": sjr_item.get("latest_quartile"),
            "latest_h_index": sjr_item.get("latest_h_index"),
            "history": sjr_item.get("history", [])
        }

    is_oa = False
    openalex_data = None
    if openalex_item:
        is_oa = bool(openalex_item.get("is_oa", False))
        openalex_data = {
            "source_ids": openalex_item.get("source_ids", []),
            "works_per_year": openalex_item.get("works_per_year", {}),
            "two_year_mean_citedness": openalex_item.get("two_year_mean_citedness"),
            "topics": openalex_item.get("topics", []),
            "topics_by_year": openalex_item.get("topics_by_year", {}),
            "top_institutions": openalex_item.get("institutions", [])
        }

    record = {
        "id": jid,
        "title": title,
        "acronym": None,
        "issn": sorted(issns),
        "publisher": (openalex_item or {}).get("publisher") or None,
        "country": (openalex_item or {}).get("country") or None,
        "core_rank": (core_item or {}).get("rank"),
        "core_rank_history": (core_item or {}).get("rank_history", []),
        "sjr": sjr_data,
        "categories": categories,
        "dblp_url": None,
        "is_oa": is_oa
    }
    if (core_item or {}).get("core_note"):
        record["core_note"] = core_item["core_note"]
    if openalex_data:
        record["openalex"] = openalex_data

    return record

def main():
    d = Path(__file__).parent / "data"
    out_file = Path(__file__).parent.parent / "conf-rank" / "src" / "data" / "journals.json"
    
    core_file = d / "core_journals.json"
    sjr_file = d / "sjr.json"
    openalex_file = d / "openalex_journals.json"

    core_list = json.loads(core_file.read_text()) if core_file.exists() else []
    sjr_list = json.loads(sjr_file.read_text()) if sjr_file.exists() else []
    openalex_map = json.loads(openalex_file.read_text()) if openalex_file.exists() else {}

    # Map CORE by cleaned ISSN and normalized title
    core_by_issn = {}
    core_by_norm_title = {}
    for c in core_list:
        core_by_norm_title[normalize_title(c["title"])] = c
        for i in c.get("issns", []):
            for ci in split_and_clean_issns(i):
                core_by_issn[ci] = c

    merged = []
    used_core_ids = set()
    used_slugs = set()

    # Process all SJR journals
    for s in sjr_list:
        matched_core = None
        # 1. Match by ISSN
        matched_issn = None
        for i in s.get("issns", []):
            for ci in split_and_clean_issns(i):
                if ci in core_by_issn:
                    candidate = core_by_issn[ci]
                    if candidate["id"] not in used_core_ids:
                        matched_core = candidate
                        matched_issn = ci
                        break
            if matched_core:
                break

        # 2. Match by normalized title if not matched by ISSN
        if not matched_core:
            norm_t = normalize_title(s["title"])
            candidate = core_by_norm_title.get(norm_t)
            if candidate and candidate["id"] not in used_core_ids:
                matched_core = candidate

        # If matched, mark CORE consumed so no other SJR journal claims it
        if matched_core:
            used_core_ids.add(matched_core["id"])
            # Remove all ISSNs of this CORE record from index to prevent reuse
            for ci_str in matched_core.get("issns", []):
                for ci in split_and_clean_issns(ci_str):
                    core_by_issn.pop(ci, None)

        first_issn = s.get("issns", [None])[0] if s.get("issns") else None
        base_slug = slugify(s["title"])
        jid = deduplicate_slug(base_slug, used_slugs, disambiguator=first_issn)

        # Look up OpenAlex enrichment by ISSN or jid
        oa_item = None
        for i in s.get("issns", []):
            for ci in split_and_clean_issns(i):
                if ci in openalex_map:
                    oa_item = openalex_map[ci]
                    break
            if oa_item:
                break
        if not oa_item and jid in openalex_map:
            oa_item = openalex_map[jid]

        rec = build_journal_record(jid, matched_core, s, oa_item)
        merged.append(rec)

    # Add remaining unmatched CORE journals
    for c in core_list:
        if c["id"] not in used_core_ids:
            first_issn = c.get("issns", [None])[0] if c.get("issns") else None
            base_slug = slugify(c["title"])
            jid = deduplicate_slug(base_slug, used_slugs, disambiguator=first_issn)
            
            oa_item = None
            for i in c.get("issns", []):
                for ci in split_and_clean_issns(i):
                    if ci in openalex_map:
                        oa_item = openalex_map[ci]
                        break
                if oa_item:
                    break
            if not oa_item and jid in openalex_map:
                oa_item = openalex_map[jid]

            rec = build_journal_record(jid, c, None, oa_item)
            merged.append(rec)

    # Sort merged list deterministically by id
    merged.sort(key=lambda x: x["id"])

    out_file.parent.mkdir(parents=True, exist_ok=True)
    out_file.write_text(json.dumps(merged, indent=1))
    print(f"Merged {len(merged)} journals -> {out_file} (matched {len(used_core_ids)} CORE records)")

if __name__ == "__main__":
    main()
