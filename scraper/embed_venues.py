"""Generate venue text embeddings for semantic suggest matching.

Document per venue: title + acronym + categories + OpenAlex top topics (when available).
Model: sentence-transformers/all-MiniLM-L6-v2 (384-dim), L2-normalized,
quantized to int8 per-vector with per-vector scale factor.

Output: conf-rank/public/venue-embeddings.json
{model, dims, vectors: {id: {s: scale, q: [int8...]}}}
"""

import json
import os
from pathlib import Path
import torch
import torch.nn.functional as F
from transformers import AutoTokenizer, AutoModel

CONF = Path(__file__).parent.parent / "conf-rank" / "src" / "data" / "conferences.json"
OUT = Path(__file__).parent.parent / "conf-rank" / "public" / "venue-embeddings.json"
MODEL_ID = "sentence-transformers/all-MiniLM-L6-v2"


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
    confs = json.loads(CONF.read_text())
    docs = [venue_doc(c) for c in confs]
    print(f"Embedding {len(docs)} venue docs with {MODEL_ID}...")

    tokenizer = AutoTokenizer.from_pretrained(MODEL_ID)
    model = AutoModel.from_pretrained(MODEL_ID)
    model.eval()

    batch_size = 64
    all_embs = []
    for i in range(0, len(docs), batch_size):
        batch = docs[i : i + batch_size]
        encoded = tokenizer(
            batch, padding=True, truncation=True, max_length=512, return_tensors="pt"
        )
        with torch.no_grad():
            out = model(**encoded)
        mask = encoded["attention_mask"].unsqueeze(-1).expand(out[0].size()).float()
        emb = torch.sum(out[0] * mask, 1) / torch.clamp(mask.sum(1), min=1e-9)
        normed = F.normalize(emb, p=2, dim=1)
        all_embs.append(normed)

    emb_tensor = torch.cat(all_embs, dim=0).cpu().numpy()

    vectors = {}
    for c, vec in zip(confs, emb_tensor):
        scale = float(abs(vec).max()) or 1.0
        q = [int(round(float(x) / scale * 127)) for x in vec]
        vectors[c["id"]] = {"s": round(scale, 6), "q": q}

    payload = {"model": MODEL_ID, "dims": int(emb_tensor.shape[1]), "vectors": vectors}
    OUT.parent.mkdir(parents=True, exist_ok=True)
    tmp = OUT.with_suffix(".tmp")
    tmp.write_text(json.dumps(payload, separators=(",", ":")))
    os.replace(tmp, OUT)
    print(f"Wrote -> {OUT} ({OUT.stat().st_size // 1024} KB)")


if __name__ == "__main__":
    main()
