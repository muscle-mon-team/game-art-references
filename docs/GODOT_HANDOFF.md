# Muscle Mon의 Godot 작업으로 넘기는 방법

이 문서는 레퍼런스 분석을 실제 게임 작업으로 넘길 때 읽을 연결 안내입니다. 게임 파일을 수정할 권한을 주는 문서는 아닙니다. 실제 구현에는 사용자에게 승인받은 대상과 범위, 게임 저장소의 최신 지침을 적용합니다.

## 확인한 기준

- 대상 게임: [`muscle-mon-team/Muscle-Mon_Godot`](https://github.com/muscle-mon-team/Muscle-Mon_Godot)
- 구조 확인 기준: [`aaafa507c40ca97a264ee6093a9b893d5cb84ebb`](https://github.com/muscle-mon-team/Muscle-Mon_Godot/tree/aaafa507c40ca97a264ee6093a9b893d5cb84ebb), 2026-11-20
- 이 안내를 작성할 때 원격 `main`이 위 커밋인지 확인했습니다. 이후 작업자는 최신 SHA와 파일을 다시 확인해야 합니다.
- 기준 소스: [AI_RULES.md](https://github.com/muscle-mon-team/Muscle-Mon_Godot/blob/aaafa507c40ca97a264ee6093a9b893d5cb84ebb/AI_RULES.md), [architecture.md](https://github.com/muscle-mon-team/Muscle-Mon_Godot/blob/aaafa507c40ca97a264ee6093a9b893d5cb84ebb/docs/architecture.md), [project.godot](https://github.com/muscle-mon-team/Muscle-Mon_Godot/blob/aaafa507c40ca97a264ee6093a9b893d5cb84ebb/game/project.godot)

이는 확인한 구조의 기록이며, 새 디자인의 동작과 실기기 성능을 검증한 결과는 아닙니다.

## 사용자 맥락과 미정인 것

사용자가 제공한 게임 방향은 Godot 4 기반 2.5D 런앤건, 고정 측면 뷰, Z=0 전투면입니다. 디자이너와 Blender 작업 담당자는 없다고 확인했습니다. 현재 디자인을 그대로 유지한다는 전제 없이 레퍼런스를 찾고 있습니다.

이 조건을 구현 시점의 최신 기획과 대조합니다. 특정 레퍼런스, 최종 캐릭터, 색 팔레트와 재질 조합은 아직 사용자 확정으로 기록되지 않았습니다. 이 저장소의 예시를 확정 기획으로 사용하지 않습니다.

## 현재 구조에서 확인할 위치

| 적용하려는 내용 | 기준 커밋에서 확인한 위치와 경계 |
| --- | --- |
| 월드, 조명과 카메라 | `game/main.gd`가 실행 중 월드를 구성. `main.tscn`에 모든 배경이 배치되어 있지 않음 |
| 엔진과 화면 설정 | 문서 기준 Godot 4.7.2, `project.godot`의 Mobile 렌더러와 1600×720 기준. 임의로 renderer와 입력을 바꾸지 않음 |
| 주인공 외형 | `player_visual.gd`, `strongman_model.gd`, `hero_model.gd` 등. 전달받은 표시 상태를 사용 |
| 일반 적 외형 | `enemy_lolli_visual.gd`, `enemy_winged_visual.gd`. 행동과 HP는 적 및 체력 구성 요소가 소유 |
| 사격과 총구 | `player.gd`가 발사 조건과 탄 생성, `shaker_gun.gd`가 표시와 총구 좌표를 제공 |
| 판정 | `bullet.gd`, `boomerang.gd`, `candy_ball.gd` 등 공격 객체. 외형 변경이 판정 변경을 뜻하지 않음 |
| 캐릭터만 비교 | `game/tools/character_preview.tscn`과 종류별 preview sample. 실제 공격과 피해를 검증하는 도구는 아님 |
| 실제 검사 | `scripts/check.py`와 게임 저장소 `docs/ai/godot.md`의 적용 가능한 검사 |

실제 변경 전에는 [플레이어 외형 계약](https://github.com/muscle-mon-team/Muscle-Mon_Godot/blob/aaafa507c40ca97a264ee6093a9b893d5cb84ebb/docs/player-visual.md), [몬스터 외형 계약](https://github.com/muscle-mon-team/Muscle-Mon_Godot/blob/aaafa507c40ca97a264ee6093a9b893d5cb84ebb/docs/monster-visual.md), [Godot 검증 지침](https://github.com/muscle-mon-team/Muscle-Mon_Godot/blob/aaafa507c40ca97a264ee6093a9b893d5cb84ebb/docs/ai/godot.md)의 해당 최신 내용을 읽습니다.

## 레퍼런스가 알려주지 않는 것

- 카메라는 기준 코드에서 원근 투영을 사용하며 좌우로 따라갑니다. 고정 측면이라는 요구가 직교 투영이나 화면 추적 금지를 자동으로 뜻하지 않습니다.
- 주인공 모델에는 뼈대가 있고 동작은 코드에서 뼈를 움직이는 방식입니다. 외부 애니메이션 클립이나 AnimationTree가 이미 있다고 가정하지 않습니다.
- 일반 적과 보스가 모두 완성된 3D 스켈레탈 모델인 상태는 아닙니다. 새 모델과 애니메이션이 필요한 범위는 리소스 확보 단계부터 따로 판단합니다.
- Mobile에서 어떤 환경 효과가 지원되는지는 실제 엔진 버전의 공식 문서와 대상 기기로 확인합니다. 다른 게임의 그림자나 블룸을 보고 같은 후처리를 모두 켜지 않습니다.
- 캐릭터 표시를 바꾸면서 HP, 재장전, 이동과 피격 범위를 중복 구현하지 않습니다. 총구 위치와 부모 좌표 변화는 실제 탄 생성에 영향을 줄 수 있으므로 확인합니다.
- 배경의 적을 전선에 합류시키는 기믹은 표시만 바꾸는 작업보다 큽니다. 기준 코드의 공격은 X/Y 거리 판정을 쓰는 경로가 있으므로, 해당 기믹을 승인받았다면 공격과 피격 가능 시점의 계약부터 확인합니다.

## 구현을 맡길 때 전달할 것

1. [스타일 정리 문서](templates/STYLE_BRIEF.md)에 선택된 REF-ID, 승인된 RULE-ID와 결정 근거
2. [구현 인수인계](templates/IMPLEMENTATION_HANDOFF.md)의 실제 대상, 최신 base, 변경 파일과 이유
3. 확보한 모델과 에셋의 경로, 라이선스와 부족한 리소스
4. 첫 화면의 범위, 유지할 게임 규칙과 완료 기준
5. 대상 저장소 지침에 맞춘 검사와 렌더, 조작 및 실기기 성능의 확인 범위

처음부터 모든 적과 보스, 배경을 교체하기보다 승인된 작은 화면에서 표현을 비교합니다. 나머지 전체 적용은 그 결과와 사용자 선택을 근거로 범위를 정합니다.
