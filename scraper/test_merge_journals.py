import pytest
from merge_journals import build_journal_record

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
