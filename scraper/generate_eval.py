"""Generate evaluation dataset of real paper abstracts with known target venues."""

import json
import ssl
import time
import urllib.request
from pathlib import Path

OPENALEX_DATA = Path(__file__).parent / "data" / "openalex.json"
CONFERENCES_DATA = Path(__file__).parent.parent / "conf-rank" / "src" / "data" / "conferences.json"
OUT = Path(__file__).parent / "data" / "eval_abstracts.json"

ctx = ssl._create_unverified_context()

def get_works_for_source(source_id: str, limit: int = 2):
    # filter for papers with abstracts and publication year between 2021 and 2024
    url = (
        f"https://api.openalex.org/works?"
        f"filter=primary_location.source.id:{source_id},has_abstract:true,from_publication_date:2020-01-01"
        f"&per_page={limit}&sort=cited_by_count:desc"
    )
    req = urllib.request.Request(url, headers={"User-Agent": "mailto:eval@confrank.org"})
    try:
        with urllib.request.urlopen(req, context=ctx, timeout=12) as resp:
            data = json.loads(resp.read().decode())
            works = []
            for item in data.get("results", []):
                inv = item.get("abstract_inverted_index")
                if not inv:
                    continue
                words = sorted([(pos, word) for word, positions in inv.items() for pos in positions])
                abstract = " ".join(word for _, word in words)
                # Ensure reasonable length
                if len(abstract.split()) >= 40:
                    works.append({
                        "paper_title": item.get("title", ""),
                        "abstract": abstract,
                        "doi": item.get("doi"),
                        "cited_by_count": item.get("cited_by_count", 0)
                    })
            return works
    except Exception as e:
        print(f"Error fetching works for {source_id}: {e}")
        return []

def main():
    oa_data = json.loads(OPENALEX_DATA.read_text())
    confs = {str(c["id"]): c for c in json.loads(CONFERENCES_DATA.read_text())}

    eval_items = []
    print(f"Building eval set from {len(oa_data)} known OpenAlex venues...")

    for vid, vdata in oa_data.items():
        if not vdata or not vdata.get("match"):
            continue
        conf = confs.get(str(vid))
        if not conf:
            continue

        src_id = vdata["match"]["id"]
        works = get_works_for_source(src_id, limit=2)
        for w in works:
            eval_items.append({
                "venue_id": str(vid),
                "venue_acronym": conf.get("acronym", ""),
                "venue_title": conf.get("title", ""),
                "venue_rank": conf.get("rank", ""),
                "paper_title": w["paper_title"],
                "abstract": w["abstract"],
                "word_count": len(w["abstract"].split()),
            })
        print(f"  {conf.get('acronym', vid)}: added {len(works)} papers")
        time.sleep(0.1)

    print(f"Total eval papers collected: {len(eval_items)}")
    OUT.write_text(json.dumps(eval_items, indent=2))
    print(f"Saved -> {OUT}")

if __name__ == "__main__":
    main()
