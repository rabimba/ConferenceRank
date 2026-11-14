from venue_match import resolve_venue, area_to_categories, norm_acr

CORE = [
    {"id": "52", "acronym": "FSE", "title": "ACM International Conference on the Foundations of Software Engineering", "rank": "A*", "dblp_url": "https://dblp.org/db/conf/sigsoft/fse"},
    {"id": "1475", "acronym": "FSE", "title": "International Workshop on Fast Software Encryption", "rank": "B", "dblp_url": "https://dblp.org/db/conf/fse"},
    {"id": "26", "acronym": "KDD", "title": "ACM International Conference on Knowledge Discovery and Data Mining", "rank": "A*", "dblp_url": "https://dblp.org/db/conf/kdd"},
]


def test_resolve_by_dblp_slug():
    assert resolve_venue("Anything", "X", "https://dblp.org/db/conf/kdd", CORE)["id"] == "26"


def test_resolve_alias_and_overrides():
    assert resolve_venue("ACM Knowledge Discovery and Data Mining", "SIGKDD", None, CORE)["id"] == "26"


def test_resolve_rank_aware_disambiguation():
    # ccfddl "FSE" 2027 entry (conf.researchr.org, title says Foundations of Software Engineering)
    v = resolve_venue("International Conference on the Foundations of Software Engineering", "FSE", None, CORE)
    assert v["id"] == "52"


def test_unresolvable_returns_none():
    assert resolve_venue("Quantum Blockchain Summit", "QBS", None, CORE) is None


def test_area_mapping():
    assert area_to_categories(["AI", "SC", "ZZ"]) == ["Artificial Intelligence", "Cybersecurity & Privacy", "General & Interdisciplinary CS"]
    assert area_to_categories([]) == ["General & Interdisciplinary CS"]


def test_norm_acr():
    assert norm_acr("IEEE VIS") == "ieeevis"


def test_dblp_slug_handles_uni_trier_and_index_html():
    assert resolve_venue("X", "KDD", "https://dblp.uni-trier.de/db/conf/kdd", CORE)["id"] == "26"
    # /index.html suffix must not become the slug
    assert resolve_venue("X", "KDD", "https://dblp.org/db/conf/kdd/index.html", CORE)["id"] == "26"


def test_no_fse_override_without_title_agreement():
    # ccf "FSE" crypto entry (no dblp): must NOT land on A* id 52 via the override
    v = resolve_venue("Fast Software Encryption", "FSE", None, CORE)
    assert v is None or v["id"] != "52"


def test_bare_dblp_slug_in_core_record():
    v = dict(CORE[2], dblp_url="kdd")  # ccfddl-style bare slug
    assert resolve_venue("Anything", "X", "https://dblp.uni-trier.de/db/conf/kdd", [v])["id"] == "26"
