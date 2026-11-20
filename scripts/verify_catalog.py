#!/usr/bin/env python3
"""Validate the catalog and optionally HEAD-check every external image URL."""
from concurrent.futures import ThreadPoolExecutor, as_completed
from pathlib import Path
from collections import Counter
import argparse
import json
import time
import urllib.request

ROOT = Path(__file__).resolve().parents[1]


def head(url):
    error = None
    for attempt in range(3):
        try:
            request = urllib.request.Request(url, method="HEAD", headers={"User-Agent": "Mozilla/5.0"})
            with urllib.request.urlopen(request, timeout=20) as response:
                if not response.headers.get("Content-Type", "").lower().startswith("image/"):
                    raise ValueError(f"Not an image: {response.headers.get('Content-Type')}")
                return {"url": url, "status": response.status}
        except Exception as exc:
            error = str(exc)
            if attempt < 2:
                time.sleep(attempt + 1)
    return {"url": url, "error": error}


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--images", action="store_true")
    args = parser.parse_args()
    catalog = json.loads((ROOT / "data/catalog.json").read_text())
    ids, screenshots, urls = set(), set(), set()
    for game in catalog["games"]:
        assert game["id"] not in ids
        ids.add(game["id"])
        assert game["dimension"] in {"2D", "2.5D", "3D"}
        assert game["screenshots"]
        assert game["source"].startswith("https://")
        for shot in game["screenshots"]:
            assert shot["id"] not in screenshots
            screenshots.add(shot["id"])
            for field in ("thumbnail", "full", "source"):
                assert shot[field].startswith("https://")
            urls.update((shot["thumbnail"], shot["full"]))
    report = {"games": len(ids), "screenshots": len(screenshots), "imageUrls": len(urls),
              "dimensions": dict(Counter(g["dimension"] for g in catalog["games"])), "imageErrors": []}
    print(json.dumps(report, ensure_ascii=False), flush=True)
    if args.images:
        checked = 0
        with ThreadPoolExecutor(max_workers=8) as executor:
            futures = [executor.submit(head, url) for url in sorted(urls)]
            for future in as_completed(futures):
                result = future.result()
                checked += 1
                if "error" in result:
                    report["imageErrors"].append(result)
                if checked % 250 == 0:
                    print(f"Checked {checked}/{len(urls)}; errors={len(report['imageErrors'])}", flush=True)
        report["checkedImageUrls"] = checked
        (ROOT / "data/verification.json").write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n")
        print(json.dumps(report, ensure_ascii=False), flush=True)
        if report["imageErrors"]:
            raise SystemExit(1)


if __name__ == "__main__":
    main()
