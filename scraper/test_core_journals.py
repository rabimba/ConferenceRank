import pytest
import sys
from pathlib import Path

# Add scraper dir to sys.path
sys.path.insert(0, str(Path(__file__).parent))

from fetch_core_journals import parse_csv_line

def test_parse_csv_line():
    line = ["356", "ACM Computing Surveys", "CORE2020", "A*", "No", "0803", "", "", "0360-0300", "1557-7341", "", ""]
    rec = parse_csv_line(line)
    assert rec["id"] == "356"
    assert rec["title"] == "ACM Computing Surveys"
    assert rec["rank"] == "A*"
    assert "0360-0300" in rec["issns"]
    assert "1557-7341" in rec["issns"]
    assert rec["for_codes"] == ["0803"]
