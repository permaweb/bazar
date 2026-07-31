#!/usr/bin/env python3
"""Derive two deterministic 100-piece PNG collections from source artworks."""

from __future__ import annotations

import hashlib
import json
import random
from pathlib import Path

from PIL import Image, ImageDraw, ImageEnhance


ROOT = Path(__file__).resolve().parents[1]
OUTPUT = ROOT / ".run-data" / "collections"
COLLECTIONS = (
    (
        "strata",
        "[TEST] Permanent Strata",
        "One hundred views into a geological archive of permanent data.",
        ROOT / "collection-art" / "sources" / "strata-source.png",
    ),
    (
        "signals",
        "[TEST] Weave Signals",
        "One hundred signals moving through a decentralized network.",
        ROOT / "collection-art" / "sources" / "signals-source.png",
    ),
)


def variation(source: Image.Image, collection: str, index: int) -> Image.Image:
    seed = int.from_bytes(hashlib.sha256(f"{collection}:{index}".encode()).digest()[:8])
    rng = random.Random(seed)
    image = source.convert("RGB")
    width, height = image.size
    crop = int(min(width, height) * rng.uniform(0.70, 0.94))
    left = rng.randrange(0, width - crop + 1)
    top = rng.randrange(0, height - crop + 1)
    image = image.crop((left, top, left + crop, top + crop)).resize((512, 512), Image.Resampling.LANCZOS)
    image = image.rotate(rng.choice((0, 90, 180, 270)))
    image = ImageEnhance.Color(image).enhance(rng.uniform(0.78, 1.32))
    image = ImageEnhance.Contrast(image).enhance(rng.uniform(0.90, 1.15))
    overlay = Image.new("RGBA", image.size, (0, 0, 0, 0))
    draw = ImageDraw.Draw(overlay)
    accent = (255, 245, 218, rng.randrange(35, 95))
    for _ in range(3 + index % 5):
        x, y = rng.randrange(20, 492), rng.randrange(20, 492)
        radius = rng.randrange(3, 22)
        draw.ellipse((x - radius, y - radius, x + radius, y + radius), outline=accent, width=rng.randrange(1, 4))
    return Image.alpha_composite(image.convert("RGBA"), overlay).convert("RGB")


def main() -> None:
    OUTPUT.mkdir(parents=True, exist_ok=True)
    summary = []
    for slug, name, description, source_path in COLLECTIONS:
        destination = OUTPUT / slug
        destination.mkdir(exist_ok=True)
        source = Image.open(source_path)
        assets = []
        for index in range(1, 101):
            filename = f"{slug}-{index:03}.png"
            image = variation(source, slug, index)
            image.save(destination / filename, "PNG", optimize=True)
            assets.append(
                {
                    "index": index,
                    "name": f"{name.removeprefix('[TEST] ')} #{index:03}",
                    "filename": filename,
                    "contentType": "image/png",
                }
            )
        manifest = {
            "name": name,
            "description": description,
            "source": "Generative collection created for Bazar 2.0 end-to-end validation.",
            "assets": assets,
        }
        (destination / "manifest.local.json").write_text(json.dumps(manifest, indent=2) + "\n")
        summary.append({"slug": slug, "name": name, "assets": len(assets)})
    print(json.dumps(summary, indent=2))


if __name__ == "__main__":
    main()
