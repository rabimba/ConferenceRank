"""Precompute query embeddings for eval abstracts to test TypeScript suggestVenues with real embeddings."""

import json
from pathlib import Path
import torch
import torch.nn.functional as F
from transformers import AutoTokenizer, AutoModel

EVAL_PATH = Path("scraper/data/eval_abstracts.json")
OUT_PATH = Path("scraper/data/eval_query_embeddings.json")

def main():
    eval_data = json.loads(EVAL_PATH.read_text())
    tokenizer = AutoTokenizer.from_pretrained("sentence-transformers/all-MiniLM-L6-v2")
    model = AutoModel.from_pretrained("sentence-transformers/all-MiniLM-L6-v2")
    model.eval()

    abstracts = [it["abstract"] for it in eval_data]
    print(f"Encoding {len(abstracts)} test abstracts...")

    encoded = tokenizer(abstracts, padding=True, truncation=True, max_length=512, return_tensors="pt")
    with torch.no_grad():
        out = model(**encoded)
    mask = encoded["attention_mask"].unsqueeze(-1).expand(out[0].size()).float()
    emb = torch.sum(out[0] * mask, 1) / torch.clamp(mask.sum(1), min=1e-9)
    normed = F.normalize(emb, p=2, dim=1).cpu().numpy().tolist()

    OUT_PATH.write_text(json.dumps(normed))
    print(f"Wrote {len(normed)} query vectors -> {OUT_PATH}")

if __name__ == "__main__":
    main()
