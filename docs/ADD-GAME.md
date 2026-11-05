# 게임 추가하기

첫 화면은 **게임 허브**다. `src/games/registry.ts` 의 `GAMES` 배열을 그대로 그린다.
게임을 늘리려면 이 파일에 항목을 넣고, `main.ts` 에서 그 id 로 갈라 주면 된다.

지금 들어 있는 게임:

| id | 제목 | 구조 |
|---|---|---|
| `adventure` | 리온의 대모험 | `src/game/`, `src/world/`, `src/levels/` (20탄) |
| `sky` | 리온의 하늘전투 | `src/sky/` + `src/skyApp.ts` (10탄) — `docs/SKY.md` |
| `arena` | 리온의 숲속대결 | `src/arena/` + `src/arenaApp.ts` (6판) — `docs/ARENA.md` |

두 번째(`sky`)·세 번째(`arena`) 게임이 이 문서대로 붙었다. 네 번째도 같은 길을 따르면 된다.
카드는 4개까지 한 줄에 들어가므로 다섯 번째부터는 `cardRect()` 줄바꿈이 필요하다.

## 화면 흐름

```
hub (게임 고르기)
 └─ title (연습 / 도전)        ← 좌상단 "← 게임" 으로 hub 복귀
     └─ select (월드 · 탄 고르기)  ← 좌상단 "← 처음" 으로 title 복귀
         └─ playing → dead / clear / gameover
```

`Esc` 키는 한 단계씩 위로 올라간다.

## 1. 레지스트리에 항목 추가

```ts
// src/games/registry.ts
export const GAMES: readonly GameEntry[] = [
  { id: 'adventure', /* … 기존 … */ },
  { id: 'sky', /* … 기존 … */ },
  {
    id: 'puzzle',              // 영문 소문자. localStorage 이름공간이 된다
    title: '리온의 퍼즐',
    subtitle: '블록 맞추기 · 전 30판',
    status: 'ready',           // 만들기 전에는 'soon'
    accent: '#f2b134',         // 카드 강조색
    emoji: '🧩',               // 또는 frame: '아틀라스 프레임 이름'
    badge: '🧊',               // 얼굴 프레임을 공유할 때 카드를 구분해 준다
  },
]
```

카드 배치는 개수에 맞춰 자동으로 잡힌다. 폭 상한(132px) 안에서 가운데 정렬되고,
4개까지는 한 줄에 들어간다. 그보다 늘리려면 `cardRect()` 에 줄바꿈을 넣어야 한다.

## 2. 진행도 저장

`progressKey(gameId, mode)` 가 키를 만든다.

| 게임 | 키 |
|---|---|
| `adventure` | `leon_game.progress.practice` |
| `sky` | `leon_game.sky.progress.practice` |
| 그 외 | `leon_game.<id>.progress.practice` |

첫 게임만 예전 키를 그대로 쓴다. **키를 바꾸면 이미 깬 기록이 날아가기 때문이다.**
새 게임은 자동으로 자기 이름공간을 쓰므로 서로 섞이지 않는다. 테스트가 키 충돌을
검사한다 (`tests/hub.test.ts`).

## 3. main.ts 에서 라우팅

`main.ts` 에 `route` 변수 하나가 있다. 이게 지금 어느 게임을 보고 있는지다.

```ts
type Route = 'hub' | 'adventure' | 'sky'
let route: Route = 'hub'
```

`update` · `render` · 포인터 · 키보드 네 군데에서 `route` 로 갈라진다.
**기존 게임 코드는 건드리지 않는다** — 분기 조건만 늘린다. 이게 규칙이다.
이미 돌아가는 게임을 고쳐 가며 새 게임을 붙이면 둘 다 망가진다.

새 게임은 `src/<이름>App.ts` 에 껍데기를 하나 만들어
`{ screen, enter, update, render, pointerDown/Move/Up, key, escape, blur, progress }`
를 내보낸다. `src/skyApp.ts` 가 그 본보기다.
게임 규칙 자체는 DOM 을 모르는 순수 모듈(`src/sky/`)에 두고,
eslint `import/no-restricted-paths` 의 PURE 목록에 디렉터리를 추가한다.

## 4. 공유되는 것

새 게임이 그대로 쓸 수 있는 것들이다.

| 모듈 | 쓰임 |
|---|---|
| `core/loop.ts` | 고정 timestep 루프 |
| `core/input.ts` · `ui/controls.ts` | 터치 3버튼 + 키보드 |
| `core/audio.ts` | WebAudio 합성 (SFX 테이블에 항목 추가) |
| `render/atlas.ts` | 스프라이트 시트 조회·폴백 |
| `storage.ts` | localStorage 래퍼 (차단 환경에서도 안 죽는다) |
| `perf.ts` | 정수 배율 · 저사양 감시 |
| `ui/orientation.ts` | 가로 모드 강제 |

스프라이트를 추가할 때는 `tools/dot/` 에 도트 정의를 넣고
`python3 tools/make_dots.py && python3 tools/build_atlas.py` 를 돌린다.
시트는 `src/assets/sprites/` 에 생성되어 번들과 함께 해시된다 —
`public/` 에 두면 캐시가 어긋난다.

## 5. 체크리스트

- [ ] `GAMES` 에 항목 추가 (`status: 'soon'` 으로 먼저 자리만 잡아도 된다)
- [ ] 순수 계층 디렉터리를 `eslint.config.js` 의 `PURE` 에 추가
- [ ] `main.ts` 의 `Route` 에 id 추가 + 네 군데 분기
- [ ] `tests/hub.test.ts` 통과 — 카드가 화면 안에 들어가고 키가 안 겹치는지
- [ ] 진행도 키가 다른 게임과 겹치지 않는지
- [ ] 새 스프라이트가 있으면 도트 생성 스크립트를 `npm run assets` 에 추가
- [ ] 데이터 검증 함수를 만들어 `main.ts` 부팅 시 assert (하늘전투의 `assertValidSkyStages`)
- [ ] `npm test && npm run lint && npm run build`
