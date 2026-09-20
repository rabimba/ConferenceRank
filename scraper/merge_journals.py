import json
import re
from pathlib import Path

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

def slugify(title):
    s = title.lower()
    s = re.sub(r"[^a-z0-9]+", "-", s).strip("-")
    return s[:80]

def clean_issn(s):
    return re.sub(r"[^0-9X]", "", s.upper())

def split_and_clean_issns(raw_issn):
    res = []
    for part in re.split(r"[,;\s]+", raw_issn or ""):
        c = clean_issn(part)
        if c and len(c) == 8:
            res.append(c)
    return res

def format_issn(s):
    c = clean_issn(s)
    if len(c) == 8:
        return f"{c[:4]}-{c[4:]}"
    return s

def build_journal_record(jid, core_item, sjr_item):
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

    return {
        "id": jid,
        "title": title,
        "acronym": None,
        "issn": list(issns),
        "publisher": None,
        "country": None,
        "core_rank": (core_item or {}).get("rank"),
        "core_rank_history": (core_item or {}).get("rank_history", []),
        "sjr": sjr_data,
        "categories": categories,
        "dblp_url": None,
        "is_oa": False
    }

def main():
    d = Path(__file__).parent / "data"
    out_file = Path(__file__).parent.parent / "conf-rank" / "src" / "data" / "journals.json"
    
    core_file = d / "core_journals.json"
    sjr_file = d / "sjr.json"

    core_list = json.loads(core_file.read_text()) if core_file.exists() else []
    sjr_list = json.loads(sjr_file.read_text()) if sjr_file.exists() else []

    # Map by cleaned ISSN and by title
    core_by_issn = {}
    core_by_title = {}
    for c in core_list:
        core_by_title[c["title"].lower().strip()] = c
        for i in c.get("issns", []):
            for ci in split_and_clean_issns(i):
                core_by_issn[ci] = c

    merged = []
    used_core_ids = set()

    # Process all SJR journals
    for s in sjr_list:
        matched_core = None
        for i in s.get("issns", []):
            for ci in split_and_clean_issns(i):
                if ci in core_by_issn:
                    matched_core = core_by_issn[ci]
                    break
            if matched_core:
                break
        if not matched_core:
            matched_core = core_by_title.get(s["title"].lower().strip())

        if matched_core:
            used_core_ids.add(matched_core["id"])

        jid = slugify(s["title"])
        rec = build_journal_record(jid, matched_core, s)
        merged.append(rec)

    # Add remaining unmatched CORE journals
    for c in core_list:
        if c["id"] not in used_core_ids:
            jid = slugify(c["title"])
            rec = build_journal_record(jid, c, None)
            merged.append(rec)

    out_file.parent.mkdir(parents=True, exist_ok=True)
    out_file.write_text(json.dumps(merged, indent=1))
    print(f"Merged {len(merged)} journals -> {out_file}")

if __name__ == "__main__":
    main()
