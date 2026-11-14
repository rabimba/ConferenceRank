import json

from discover_venues import openreview_candidate, discover, load_blocked

COLM = {"id": "or-colm", "acronym": "COLM", "title": "Conference on Language Modeling",
        "dblp": None, "website": "https://colm.cc", "evidence": ["openreview:COLM/2026/Conference"], "areas": ["AI"]}
OLD = {"id": "or-oldven", "acronym": "OLDVEN", "title": "Conference on Old Venues",
       "dblp": None, "website": None, "evidence": ["openreview:OLDVEN/2025/Conference"], "areas": []}


def test_verify_requires_evidence(tmp_path):
    out = discover([COLM], blocked=[], existing=[], verify_fn=lambda c: None)
    assert out == []


def test_blocked_venues_skipped(tmp_path):
    blocked = [{"acronym": "COLM", "reason": "predatory"}]
    out = discover([COLM], blocked=blocked, existing=[], verify_fn=lambda c: "dblp:colm")
    assert out == []


def test_existing_entries_preserved(tmp_path):
    out = discover([], blocked=[], existing=[OLD], verify_fn=lambda c: "dblp:x")
    assert [v["id"] for v in out] == ["or-oldven"]


def test_id_stable_and_sorted(tmp_path):
    cands = [COLM, {"id": "or-aavl", "acronym": "AAVL", "title": "A Venue", "dblp": None, "website": None, "evidence": ["openreview:AAVL/2027/Conference"], "areas": []}]
    o1 = discover(cands, blocked=[], existing=[], verify_fn=lambda c: "dblp:x")
    o2 = discover(list(reversed(cands)), blocked=[], existing=[], verify_fn=lambda c: "dblp:x")
    assert json.dumps(o1) == json.dumps(o2)
    assert [v["id"] for v in o1] == sorted(v["id"] for v in o1)


def test_openreview_acr_extraction():
    cand = openreview_candidate("AAAI.org/2027/Conference")
    assert cand["acronym"] == "AAAI"
    assert cand["id"] == "or-aaai"


def test_blocked_loading(tmp_path):
    p = tmp_path / "blocked.json"
    p.write_text(json.dumps([{"acronym": "SPAM", "reason": "test"}]))
    assert load_blocked(p) == ["spam"]
