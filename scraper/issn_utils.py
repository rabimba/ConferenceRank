import re

def clean_issn(s: str | None) -> str:
    """Strip all non-alphanumeric chars except X and uppercase."""
    if not s:
        return ""
    return re.sub(r"[^0-9X]", "", str(s).upper())

def split_and_clean_issns(raw_issn: str | None) -> list[str]:
    """Parse comma, semicolon, or whitespace separated ISSNs, keeping valid 8-char ones."""
    res = []
    for part in re.split(r"[,;\s]+", raw_issn or ""):
        c = clean_issn(part)
        if c and len(c) == 8:
            res.append(c)
    return res

def format_issn(s: str | None) -> str:
    """Format 8-char ISSN with hyphen: 1234-5678."""
    c = clean_issn(s)
    if len(c) == 8:
        return f"{c[:4]}-{c[4:]}"
    return s or ""
