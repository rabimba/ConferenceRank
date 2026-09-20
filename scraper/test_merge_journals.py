import pytest
from merge_journals import build_journal_record, split_and_clean_issns, format_issn
from fetch_sjr import parse_issns

def test_build_journal_record():
    core_item = {
        "id": "356",
        "title": "ACM Computing Surveys",
        "rank": "A*",
        "source": "CORE2020",
        "issns": ["0360-0300", "1557-7341"],
        "for_codes": ["0803"],
        "rank_history": [{"source": "CORE2020", "rank": "A*"}]
    }
    sjr_item = {
        "title": "ACM Computing Surveys",
        "latest_score": 4.12,
        "latest_quartile": "Q1",
        "latest_h_index": 185,
        "issns": ["03600300", "15577341"],
        "history": [{"year": 2024, "sjr": 4.12, "quartile": "Q1", "h_index": 185}]
    }
    rec = build_journal_record("acm-computing-surveys", core_item, sjr_item)
    assert rec["id"] == "acm-computing-surveys"
    assert rec["core_rank"] == "A*"
    assert rec["sjr"]["latest_quartile"] == "Q1"
    assert rec["sjr"]["latest_h_index"] == 185
    assert "0360-0300" in rec["issn"]
    assert "1557-7341" in rec["issn"]

def test_comma_separated_issn_splitting():
    raw_sjr_issn = "0360-0300, 1557-7341"
    parsed = parse_issns(raw_sjr_issn)
    assert parsed == ["03600300", "15577341"]

    split_cleaned = split_and_clean_issns(raw_sjr_issn)
    assert split_cleaned == ["03600300", "15577341"]
    assert [format_issn(x) for x in split_cleaned] == ["0360-0300", "1557-7341"]

