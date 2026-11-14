from merge import build_emerging_records, clean_stats

DISCOVERED = [
    {
        "id": "or-colm", "title": "Conference on Language Modeling", "acronym": "COLM",
        "rank": "Unranked", "for_codes": [], "categories": ["Artificial Intelligence"],
        "dblp_url": "https://dblp.org/db/conf/colm", "website": "https://colm.cc",
        "evidence": ["openreview:COLM/2026/Conference", "dblp:colm"], "emerging": True,
    }
]


def test_emerging_record_shape():
    deadlines = {"or-colm": [{"year": 2026, "paper_deadline": "2026-03-31 23:59:59", "source": "ccf"}]}
    recs = build_emerging_records(DISCOVERED, deadlines)
    assert len(recs) == 1
    r = recs[0]
    assert r["emerging"] is True
    assert r["rank"] == "Unranked"
    assert r["deadlines"] == deadlines["or-colm"]
    assert r["stats"] is None and r["stats_source"] is None
    assert r["rank_history"] == []
    assert r["id"] == "or-colm"


def test_emerging_without_deadlines():
    recs = build_emerging_records(DISCOVERED, {})
    assert recs[0]["deadlines"] is None
    assert recs[0]["emerging"] is True
