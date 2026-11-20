#!/usr/bin/env python3
"""Merge curated source metadata into the static gallery catalog."""
from collections import Counter
from pathlib import Path
from hashlib import sha256
import json

ROOT = Path(__file__).resolve().parents[1]
TAG_MAP = {
    "장난감": "토이", "카툰": "만화풍", "종이 공예": "종이공예",
    "디오라마": "미니어처", "봉제 인형": "수공예", "털실": "수공예",
}
STYLE_TAGS = ["토이", "클레이", "종이공예", "수공예", "미니어처", "로우폴리",
              "손그림", "만화풍", "픽셀아트", "동화풍", "파스텔", "따뜻함", "자연", "네온", "어두움", "액션", "레트로", "일러스트"]


def main():
    steam = json.loads((ROOT / "data/steam-catalog.json").read_text())
    console = json.loads((ROOT / "data/console-sources.json").read_text())
    games = []
    for source in console["games"]:
        tags = list(dict.fromkeys(TAG_MAP.get(tag, tag) for tag in source["tags"]))
        primary = [tag for tag in tags if tag in STYLE_TAGS]
        if source["id"] in {"kirbys-return-to-dream-land-deluxe", "kirby-star-allies", "kirby-and-the-forgotten-land"}:
            primary = list(dict.fromkeys(["토이", "만화풍", "동화풍"] + primary))
        if source["id"] in {"links-awakening", "captain-toad-treasure-tracker", "animal-crossing-new-horizons"}:
            primary = list(dict.fromkeys(["토이", "미니어처"] + primary))
        games.append({
            "id": source["id"], "title": source["title"], "searchTerms": source["titleKo"],
            "dimension": source["dimension"],
            "camera": "횡스크롤" if source["camera"] == "측면" else source["camera"],
            "tags": primary, "details": tags, "note": source["classificationNote"],
            "featured": True, "source": source["sourceUrl"], "sourceLabel": source["sourceName"],
            "credit": source["credit"],
            "screenshots": [{"id": shot["id"], "thumbnail": shot["thumbnailUrl"],
                             "full": shot["url"], "source": shot["sourceUrl"]}
                            for shot in source["screenshots"]],
        })
    games.extend(steam["games"])
    ids, shot_ids, image_urls = set(), set(), set()
    for game in games:
        assert game["id"] not in ids, f"Duplicate game: {game['id']}"
        ids.add(game["id"])
        assert game["dimension"] in {"2D", "2.5D", "3D"}
        assert game["screenshots"], f"Empty game: {game['id']}"
        assert game["source"].startswith("https://")
        unique = []
        for shot in game["screenshots"]:
            key = shot["full"].split("?", 1)[0]
            # Keep favorites attached to the same image when a source reorders its gallery.
            shot["id"] = f"{game['id']}-{sha256(key.encode()).hexdigest()[:12]}"
            assert shot["id"] not in shot_ids, f"Duplicate screenshot ID: {shot['id']}"
            shot_ids.add(shot["id"])
            assert all(shot[k].startswith("https://") for k in ["full", "thumbnail", "source"])
            if key in image_urls:
                continue
            image_urls.add(key)
            unique.append(shot)
        game["screenshots"] = unique
    payload = {
        "schemaVersion": 1, "collectedOn": "2026-11-20", "styleTags": STYLE_TAGS,
        "classificationNote": "화면의 표현과 주된 공간을 기준으로 정리한 감상용 분류입니다. 엔진이나 Z축 이동 제한을 뜻하지 않으며, 혼합형은 게임 설명에 표시했습니다.",
        "games": games,
    }
    (ROOT / "data/catalog.json").write_text(json.dumps(payload, ensure_ascii=False, separators=(",", ":")) + "\n")
    print(json.dumps({"games": len(games), "screenshots": len(image_urls), "dimensions": dict(Counter(g['dimension'] for g in games))}, ensure_ascii=False))


if __name__ == "__main__":
    main()
