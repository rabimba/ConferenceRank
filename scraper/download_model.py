"""Download Xenova/all-MiniLM-L6-v2 quantized ONNX model for self-hosting in conf-rank/public/models."""

import ssl
import urllib.request
from pathlib import Path

OUT_DIR = Path(__file__).parent.parent / "conf-rank" / "public" / "models" / "all-MiniLM-L6-v2"
BASE_URL = "https://huggingface.co/Xenova/all-MiniLM-L6-v2/resolve/main"

FILES = [
    "config.json",
    "tokenizer.json",
    "tokenizer_config.json",
    "special_tokens_map.json",
    "onnx/model_quantized.onnx",
]

ctx = ssl._create_unverified_context()

def download_file(rel_path: str):
    target = OUT_DIR / rel_path
    if target.exists() and target.stat().st_size > 0:
        print(f"Already exists: {rel_path} ({target.stat().st_size // 1024} KB)")
        return

    target.parent.mkdir(parents=True, exist_ok=True)
    url = f"{BASE_URL}/{rel_path}"
    print(f"Downloading {url} -> {target} ...")
    req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
    with urllib.request.urlopen(req, context=ctx, timeout=60) as resp, open(target, "wb") as f:
        f.write(resp.read())
    print(f"Done: {rel_path} ({target.stat().st_size // 1024} KB)")

def main():
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    for f in FILES:
        download_file(f)
    print(f"\nAll model files ready in {OUT_DIR}")

if __name__ == "__main__":
    main()
