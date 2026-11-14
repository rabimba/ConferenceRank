import json
import zipfile

import pytest
import requests

from fetch_deadlines import build_deadlines, canonicalize, run_adapters, collect_accept_rates

CORE = [
    {"id": "52", "acronym": "FSE", "title": "ACM International Conference on the Foundations of Software Engineering", "rank": "A*", "dblp_url": "https://dblp.org/db/conf/sigsoft/fse"},
    {"id": "1475", "acronym": "FSE", "title": "International Workshop on Fast Software Encryption", "rank": "B", "dblp_url": "https://dblp.org/db/conf/fse"},
    {"id": "26", "acronym": "KDD", "title": "ACM International Conference on Knowledge Discovery and Data Mining", "rank": "A*", "dblp_url": "https://dblp.org/db/conf/kdd"},
]


def entry(source="ccf", acr="FSE", title="International Conference on the Foundations of Software Engineering", year=2027, ddl="2026-09-21 23:59:59", **kw):
    d = {
        "title": title, "acronym": acr, "dblp": None, "year": year,
        "cycle": None, "abstract_deadline": None, "paper_deadline": ddl,
        "notification_date": None, "timezone": "AoE", "location": None,
        "conference_dates": None, "cfp_url": None, "source": source, "areas": [],
    }
    d.update(kw)
    return d


def test_output_is_deterministic():
    entries = [entry(), entry(source="openreview", ddl="2026-09-22 00:00:00")]
    d1 = canonicalize(build_deadlines(CORE, None, entries))
    d2 = canonicalize(build_deadlines(CORE, None, list(reversed(entries))))
    assert json.dumps(d1, sort_keys=True) == json.dumps(d2, sort_keys=True)


def test_dedup_prefers_ccf():
    entries = [
        entry(source="openreview", ddl="2026-09-21 23:59:59"),
        entry(source="ccf", ddl="2026-09-21 23:59:59"),
    ]
    merged = build_deadlines(CORE, None, entries)
    assert len(merged["52"]) == 1
    assert merged["52"][0]["source"] == "ccf"


def test_fse_id52_gets_deadlines():
    merged = build_deadlines(CORE, None, [entry()])
    assert merged["52"]
    assert all(e["source"] == "ccf" for e in merged["52"])


def test_missing_source_is_tolerated():
    def boom():
        raise requests.RequestException("network down")

    good = lambda: [entry()]  # noqa: E731
    assert run_adapters([boom, good]) == [entry()]


def test_accept_rates_parsed(tmp_path):
    zpath = tmp_path / "ccf.zip"
    with zipfile.ZipFile(zpath, "w") as z:
        z.writestr("ccf-deadlines-main/accept_rates/AI/aaai.yml",
                   "- title: AAAI\n"
                   "  accept_rates:\n"
                   "    - year: 2026\n"
                   "      submitted: 23680\n"
                   "      accepted: 4167\n"
                   "      rate: 0.17597\n"
                   "      source: https://example.com\n")
    out = collect_accept_rates(zpath)
    rows = out["aaai"]
    assert rows[0]["year"] == 2026
    assert rows[0]["accepted"] == 4167
    assert rows[0]["submitted"] == 23680
    assert rows[0]["rate"] == pytest.approx(17.597, rel=1e-3)
