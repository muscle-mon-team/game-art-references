#!/usr/bin/env python3
"""Collect publisher-provided screenshot URLs, not image binaries, from Steam."""
from concurrent.futures import ThreadPoolExecutor, as_completed
from datetime import datetime, timezone
from pathlib import Path
import argparse
import json
import re
import time
import urllib.request

ROOT = Path(__file__).resolve().parents[1]


def normalized(value):
    return re.sub(r"[^a-z0-9]", "", value.lower())


def collect(seed, refresh=False):
    appid, expected, ko, dimension, camera, tags, note, featured = seed
    cache = ROOT / ".cache" / f"steam-{appid}.json"
    if cache.exists() and not refresh:
        raw = json.loads(cache.read_text())
    else:
        last_error = None
        for attempt in range(3):
            try:
                request = urllib.request.Request(
                    f"https://store.steampowered.com/api/appdetails?appids={appid}&l=english",
                    headers={"User-Agent": "GameArtReferenceCatalog/1.0"},
                )
                with urllib.request.urlopen(request, timeout=25) as response:
                    raw = json.load(response)
                cache.parent.mkdir(exist_ok=True)
                cache.write_text(json.dumps(raw, ensure_ascii=False))
                break
            except Exception as error:
                last_error = error
                time.sleep(attempt + 1)
        else:
            raise RuntimeError(f"{expected}: {last_error}")
    item = raw.get(appid, {})
    if not item.get("success"):
        raise ValueError(f"{appid} {expected}: source unavailable")
    data = item["data"]
    actual = data["name"]
    if normalized(expected) not in normalized(actual):
        raise ValueError(f"{appid}: expected {expected!r}, received {actual!r}")
    source = f"https://store.steampowered.com/app/{appid}/"
    screenshots = []
    seen = set()
    for item in data.get("screenshots", []):
        full = item["path_full"]
        key = full.split("?", 1)[0]
        if key in seen:
            continue
        seen.add(key)
        screenshots.append({
            "id": f"steam-{appid}-{item['id']}",
            "thumbnail": item["path_thumbnail"],
            "full": full,
            "source": source,
        })
    if not screenshots:
        raise ValueError(f"{expected}: no screenshots in source")
    return {
        "id": f"steam-{appid}", "title": actual, "searchTerms": ko,
        "dimension": dimension, "camera": camera,
        "tags": tags.split(","), "note": note, "featured": featured == "1",
        "source": source, "sourceLabel": "Steam 공식 스토어",
        "developers": data.get("developers", []),
        "publishers": data.get("publishers", []),
        "screenshots": screenshots,
    }


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--refresh", action="store_true")
    args = parser.parse_args()
    seeds = [line.split("|") for line in (ROOT / "data/steam-seeds.tsv").read_text().splitlines()
             if line.strip() and not line.startswith("#")]
    assert all(len(seed) == 8 for seed in seeds), "Invalid seed row"
    assert len({seed[0] for seed in seeds}) == len(seeds), "Duplicate app ID"
    results, errors = {}, []
    with ThreadPoolExecutor(max_workers=4) as executor:
        futures = {executor.submit(collect, seed, args.refresh): seed for seed in seeds}
        for future in as_completed(futures):
            seed = futures[future]
            try:
                result = future.result()
                results[result["id"]] = result
                print(f"OK {result['title']}: {len(result['screenshots'])}", flush=True)
            except Exception as error:
                errors.append({"appid": seed[0], "expected": seed[1], "error": str(error)})
                print(f"FAILED {error}", flush=True)
    games = [results[f"steam-{seed[0]}"] for seed in seeds if f"steam-{seed[0]}" in results]
    payload = {"collectedAt": datetime.now(timezone.utc).isoformat(), "games": games}
    (ROOT / "data/steam-catalog.json").write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n")
    (ROOT / "data/collection-errors.json").write_text(json.dumps(errors, ensure_ascii=False, indent=2) + "\n")
    print(json.dumps({"games": len(games), "screenshots": sum(len(g['screenshots']) for g in games), "errors": errors}, ensure_ascii=False))
    if errors:
        raise SystemExit(1)


if __name__ == "__main__":
    main()
