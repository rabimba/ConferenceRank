import pytest
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))

from merge_journals import build_journal_record, slugify, deduplicate_slug, normalize_title
from issn_utils import split_and_clean_issns, format_issn, clean_issn
from fetch_sjr import compute_quartile_thresholds, score_to_quartile, best_quartile

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

def test_slug_deduplication():
    used = set()
    s1 = deduplicate_slug("library-resources", used, disambiguator="00242527")
    assert s1 == "library-resources"
    assert "library-resources" in used

    s2 = deduplicate_slug("library-resources", used, disambiguator="15450546")
    assert s2 == "library-resources-15450546"
    assert s2 in used

    s3 = deduplicate_slug("library-resources", used, disambiguator=None)
    assert s3 == "library-resources-2"

def test_comma_separated_issn_splitting():
    raw_sjr_issn = "0360-0300, 1557-7341"
    split_cleaned = split_and_clean_issns(raw_sjr_issn)
    assert split_cleaned == ["03600300", "15577341"]
    assert [format_issn(x) for x in split_cleaned] == ["0360-0300", "1557-7341"]

def test_quartile_percentile_calculation():
    # 8 scores in field '1701', year 2024
    # Scores: 0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8
    field_scores = {
        ("1701", 2024): [0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8]
    }
    thresholds = compute_quartile_thresholds(field_scores)
    cutoffs = thresholds[("1701", 2024)]
    # Top score 0.8 is Q1
    assert score_to_quartile(0.8, cutoffs) == "Q1"
    assert score_to_quartile(0.7, cutoffs) == "Q1"
    # Middle score 0.5 is Q2
    assert score_to_quartile(0.5, cutoffs) == "Q2"
    # Lower score 0.2 is Q4
    assert score_to_quartile(0.2, cutoffs) == "Q4"

def test_best_quartile():
    assert best_quartile("Q1", "Q3") == "Q1"
    assert best_quartile("Q4", "Q2") == "Q2"
    assert best_quartile(None, "Q3") == "Q3"
    assert best_quartile("Q1", None) == "Q1"
