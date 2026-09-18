"""Generate venue text embeddings for semantic suggest matching.

Document per venue: title + categories + OpenAlex top topics (when available).
Model: sentence-transformers/all-MiniLM-L6-v2 (384-dim), L2-normalized,
quantized to int8 per-vector with per-vector scale factor.

Output: conf-rank/public/venue-embeddings.json
{model, dims, vectors: {id: {s: scale, q: [int8...]}}}

Requires: pip install -r scraper/requirements-embed.txt
Run after merge.py so conferences.json is fresh.
"""

import json
from pathlib import Path

D = Path(__file__).parent / "data"
CONF = Path(__file__).parent.parent / "conf-rank" / "src" / "data" / "conferences.json"
OUT = Path(__file__).parent.parent / "conf-rank" / "public" / "venue-embeddings.json"
MODEL = "sentence-transformers/all-MiniLM-L6-v2"


def venue_doc(c: dict) -> str:
    parts = [c.get("title") or c.get("id", "")]
    if c.get("acronym"):
        parts.append(f"({c['acronym']})")
    if c.get("categories"):
        parts.append("Fields: " + ", ".join(c["categories"]))
    oa = c.get("openalex")
    if oa and oa.get("topics"):
        parts.append("Topics: " + ", ".join(t["name"] for t in oa["topics"][:8]))
    return " ".join(parts)


def main():
    from sentence_transformers import SentenceTransformer

    confs = json.loads(CONF.read_text())
    docs = [venue_doc(c) for c in confs]
    print(f"Embedding {len(docs)} venue docs with {MODEL}...")

    model = SentenceTransformer(MODEL)
    emb = model.encode(docs, normalize_embeddings=True, show_progress_bar=True)

    vectors = {}
    for c, vec in zip(confs, emb):
        scale = float(abs(vec).max()) or 1.0
        q = [int(round(x / scale * 127)) for x in vec]
        vectors[c["id"]] = {"s": round(scale, 6), "q": q}

    payload = {"model": MODEL, "dims": int(emb.shape[1]), "vectors": vectors}
    OUT.parent.mkdir(parents=True, exist_ok=True)
    import os
    tmp = OUT.with_suffix(".tmp")
    tmp.write_text(json.dumps(payload, separators=(",", ":")))
    os.replace(tmp, OUT)
    print(f"wrote -> {OUT} ({OUT.stat().st_size // 1024} KB)")


if __name__ == "__main__":
    main()
