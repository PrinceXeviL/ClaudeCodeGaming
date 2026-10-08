#!/usr/bin/env python3
"""Generate images with Google AI Studio (Gemini API).

The API key is read from the GEMINI_API_KEY environment variable, or from a
gitignored `.env` file in the repo root (GEMINI_API_KEY=...).

Examples:
    python3 scripts/generate_image.py "pixel art knight, side view" -o assets/knight.png
    python3 scripts/generate_image.py "same knight, attacking" --ref assets/knight.png -o assets/knight_attack.png
    python3 scripts/generate_image.py --list-models
    python3 scripts/generate_image.py -f prompt.txt -m gemini-3-pro-image -a 16:9 -r ref.png -r guide.png -o out.png

Note: image models have NO free-tier quota (limit 0); the Google AI Studio project of the key needs billing enabled,
otherwise every call fails with "API error 429 ... free_tier ... limit: 0".
"""

import argparse
import base64
import json
import mimetypes
import os
import sys
import urllib.error
import urllib.request
from pathlib import Path

API_BASE = "https://generativelanguage.googleapis.com/v1beta"
DEFAULT_MODEL = "gemini-2.5-flash-image"
ASPECT_RATIOS = ["1:1", "2:3", "3:2", "3:4", "4:3", "4:5", "5:4", "9:16", "16:9", "21:9"]
REPO_ROOT = Path(__file__).resolve().parent.parent


def load_api_key():
    key = os.environ.get("GEMINI_API_KEY")
    if key:
        return key.strip()
    env_file = REPO_ROOT / ".env"
    if env_file.exists():
        for line in env_file.read_text().splitlines():
            name, sep, value = line.partition("=")
            if sep and name.strip() == "GEMINI_API_KEY":
                return value.strip().strip("\"'")
    sys.exit("GEMINI_API_KEY not set (export it or add it to .env in the repo root)")


def api_request(method, path, key, body=None):
    data = json.dumps(body).encode() if body is not None else None
    req = urllib.request.Request(
        f"{API_BASE}/{path}",
        data=data,
        method=method,
        headers={"x-goog-api-key": key, "Content-Type": "application/json"},
    )
    try:
        with urllib.request.urlopen(req, timeout=300) as resp:
            return json.load(resp)
    except urllib.error.HTTPError as e:
        detail = e.read().decode(errors="replace")
        try:
            detail = json.loads(detail)["error"]["message"]
        except (ValueError, KeyError):
            pass
        sys.exit(f"API error {e.code}: {detail}")


def list_models(key):
    models = api_request("GET", "models?pageSize=200", key).get("models", [])
    for m in models:
        if "image" in m["name"]:
            print(m["name"].removeprefix("models/"))


def image_part(path):
    mime = mimetypes.guess_type(path)[0] or "image/png"
    return {"inline_data": {"mime_type": mime, "data": base64.b64encode(Path(path).read_bytes()).decode()}}


def generate(key, prompt, model, refs, aspect_ratio):
    parts = [image_part(p) for p in refs] + [{"text": prompt}]
    body = {
        "contents": [{"parts": parts}],
        "generationConfig": {"responseModalities": ["TEXT", "IMAGE"]},
    }
    if aspect_ratio:
        body["generationConfig"]["imageConfig"] = {"aspectRatio": aspect_ratio}
    resp = api_request("POST", f"models/{model}:generateContent", key, body)

    images, texts = [], []
    for cand in resp.get("candidates", []):
        for part in cand.get("content", {}).get("parts", []):
            blob = part.get("inlineData") or part.get("inline_data")
            if blob:
                images.append((blob.get("mimeType") or blob.get("mime_type"), base64.b64decode(blob["data"])))
            elif part.get("text") and not part.get("thought"):
                texts.append(part["text"])
    if not images:
        reason = resp.get("promptFeedback") or [c.get("finishReason") for c in resp.get("candidates", [])]
        sys.exit(f"No image returned. {' '.join(texts)} {reason}".strip())
    return images, texts


def main():
    p = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    p.add_argument("prompt", nargs="?", help="what to draw")
    p.add_argument("-o", "--out", default="output.png", help="output file (extra images get _2, _3 ...)")
    p.add_argument("-m", "--model", default=DEFAULT_MODEL, help=f"model id (default: {DEFAULT_MODEL})")
    p.add_argument("-a", "--aspect", choices=ASPECT_RATIOS, help="aspect ratio, e.g. 16:9")
    p.add_argument("-r", "--ref", action="append", default=[], help="reference image to edit or match (repeatable)")
    p.add_argument("-f", "--prompt-file", help="read the prompt from a text file (for long prompts)")
    p.add_argument("--list-models", action="store_true", help="list image-capable models and exit")
    args = p.parse_args()

    key = load_api_key()
    if args.list_models:
        list_models(key)
        return
    if args.prompt_file:
        args.prompt = Path(args.prompt_file).read_text(encoding="utf-8").strip()
    if not args.prompt:
        p.error("prompt is required")

    images, texts = generate(key, args.prompt, args.model, args.ref, args.aspect)
    out = Path(args.out)
    out.parent.mkdir(parents=True, exist_ok=True)
    for i, (mime, data) in enumerate(images, 1):
        ext = mimetypes.guess_extension(mime or "image/png") or ".png"
        target = out.with_suffix(ext) if i == 1 else out.with_name(f"{out.stem}_{i}{ext}")
        target.write_bytes(data)
        print(f"saved {target} ({len(data) // 1024} KB)")
    for t in texts:
        print(t.strip())


if __name__ == "__main__":
    main()
