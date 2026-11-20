# FRAME — 게임 아트 레퍼런스

Muscle Mon의 비주얼 방향을 탐색하기 위한 공개 스크린샷 라이브러리입니다.

**웹:** https://muscle-mon-team.github.io/game-art-references/

현재 카탈로그는 `data/catalog.json`에 있습니다. 게임과 이미지 수는 웹에서 해당 파일을 기준으로 계산합니다.

## 둘러보기

- 게임별 카드 또는 여러 게임의 스크린샷을 섞어서 보기
- 2D, 2.5D, 3D 및 스타일 태그로 필터링
- 한국어와 영어 게임명, 분위기, 질감 검색
- 측면 시점만 보기와 장면 수 기준 정렬
- 원본 이미지 확대, 게임 안의 스크린샷 이동, 공식 출처 열기
- 브라우저에 저장되는 즐겨찾기와 장면별 메모
- 최대 네 장을 나란히 비교
- 내 선택 JSON 내보내기와 다른 브라우저에서 가져오기

즐겨찾기와 메모는 서버나 GitHub에 전송하지 않습니다. 현재 브라우저의 로컬 저장소에만 보관됩니다. 다른 기기에서 보려면 JSON 파일을 내보내고 가져와야 합니다. 가져오기는 기존 선택에 합치는 방식입니다.

## 분류 기준

이 분류는 게임 아트 감상을 위한 편집 기준이며, 엔진이나 이동축에 관한 기술 명세가 아닙니다.

- **2D:** 그림, 손그림, 픽셀 등을 중심으로 읽히는 화면
- **2.5D:** 주로 측면에서 보는 입체 또는 혼합 표현
- **3D:** 입체 공간을 주로 사용하는 게임. 고정 시점과 자유 시점 모두 포함

혼합형과 깊이 이동이 있는 게임은 게임 설명에 표시합니다. 스타일 태그는 비교를 위한 관찰 기준이며 제작사의 공식 기술 분류가 아닙니다.

## 이미지와 권리

스크린샷 원본은 저장소에 업로드하지 않습니다. Steam에서 제작사가 제공한 공식 스토어 스크린샷과 Nintendo 공식 사이트의 이미지 URL에 연결합니다. 각 이미지에는 원본 페이지 링크가 있습니다.

이미지와 게임의 권리는 각 제작사와 권리자에게 있습니다. 이 라이브러리는 이미지를 게임 제작용 에셋으로 제공하거나 재사용 라이선스를 부여하지 않습니다.

출처의 URL 변경, 이미지 삭제, 네트워크 또는 제공사의 연결 정책으로 일부 이미지가 표시되지 않을 수 있습니다. 이 경우 각 카드의 공식 출처 링크를 이용하세요.

## 로컬 실행

별도 패키지 설치나 빌드 없이 Python 3만 있으면 됩니다.

```sh
python3 -m http.server 8000
```

브라우저에서 http://localhost:8000 을 엽니다. HTML 파일을 직접 더블클릭하는 대신 HTTP 서버로 실행해야 카탈로그를 읽을 수 있습니다.

## 자료 갱신

```sh
python3 scripts/collect_steam.py
python3 scripts/build_catalog.py
python3 scripts/verify_catalog.py
node --check app.js
```

- `data/steam-seeds.tsv`: 수집할 Steam 게임과 사람이 정리한 분류, 태그
- `data/steam-catalog.json`: 제작사 제공 스토어 이미지 URL과 출처 메타데이터
- `data/console-sources.json`: 공식 Nintendo 페이지에서 확인한 이미지 URL과 출처
- `data/catalog.json`: 웹에서 읽는 통합 카탈로그
- `data/collection-errors.json`: 수집 중 실패한 항목. 오류를 정상적인 빈 목록으로 바꾸지 않습니다.
- `scripts/collect_steam.py --refresh`: 캐시를 쓰지 않고 Steam 목록 다시 수집
- `scripts/verify_catalog.py --images`: 전체 썸네일과 원본의 이미지 HTTP 응답 확인. 결과는 `data/verification.json`에 기록

새 게임은 ID와 실제 스토어 제목의 일치 여부를 확인한 뒤 추가합니다. 게임 이름과 다른 앱, 사운드트랙, 이미지 중복은 카탈로그에 넣지 않습니다. 이미지 URL의 HTTP 성공은 실제 장면의 내용 검수를 대신하지 않습니다.

## 배포

GitHub Pages가 `main` 브랜치의 루트 폴더를 게시합니다. `.nojekyll` 파일로 Jekyll 처리를 생략하며, 정적 HTML/CSS/JavaScript와 JSON만 사용합니다. 서버, 데이터베이스, API 키는 필요하지 않습니다.

기존 `Muscle-Mon_Godot` 게임 저장소와 분리되어 있습니다.
