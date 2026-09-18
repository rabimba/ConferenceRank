"""Download transformers.min.js and onnxruntime wasm binaries for self-hosting."""

import ssl
import urllib.request
from pathlib import Path

OUT_DIR = Path(__file__).parent.parent / "conf-rank" / "public" / "vendor"
ctx = ssl._create_unverified_context()

FILES = [
    ("transformers.min.js", "https://cdn.jsdelivr.net/npm/@huggingface/transformers@3.3.3/dist/transformers.min.js"),
    ("transformers.js", "https://cdn.jsdelivr.net/npm/@huggingface/transformers@3.3.3/dist/transformers.js"),
]

def main():
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    for name, url in FILES:
        target = OUT_DIR / name
        if target.exists() and target.stat().st_size > 0:
            print(f"Already exists: {name} ({target.stat().st_size // 1024} KB)")
            continue
        print(f"Downloading {name} from {url}...")
        try:
            req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
            with urllib.request.urlopen(req, context=ctx, timeout=60) as resp, open(target, "wb") as f:
                f.write(resp.read())
            print(f"Saved: {name} ({target.stat().st_size // 1024} KB)")
        except Exception as e:
            print(f"Warning: could not download {name}: {e}")

if __name__ == "__main__":
    main()
