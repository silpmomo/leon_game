# 두 번째 게임 추가하기

첫 화면은 **게임 허브**다. `src/games/registry.ts` 의 `GAMES` 배열을 그대로 그린다.
게임을 늘리려면 이 파일에 항목을 넣고, `main.ts` 에서 그 id 로 갈라 주면 된다.

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
  {
    id: 'puzzle',              // 영문 소문자. localStorage 이름공간이 된다
    title: '리온의 퍼즐',
    subtitle: '블록 맞추기 · 전 30판',
    status: 'ready',           // 만들기 전에는 'soon'
    accent: '#f2b134',         // 카드 강조색
    emoji: '🧩',               // 또는 frame: '아틀라스 프레임 이름'
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
| 그 외 | `leon_game.<id>.progress.practice` |

첫 게임만 예전 키를 그대로 쓴다. **키를 바꾸면 이미 깬 기록이 날아가기 때문이다.**
새 게임은 자동으로 자기 이름공간을 쓰므로 서로 섞이지 않는다. 테스트가 키 충돌을
검사한다 (`tests/hub.test.ts`).

## 3. main.ts 에서 라우팅

지금은 게임이 하나라 `hub → title` 로 바로 간다. 두 번째 게임을 붙일 때는
고른 `gameId` 에 따라 씬을 갈라 준다.

```ts
if (state.scene === 'hub') {
  const picked = gameHitTest(px, py)
  if (picked === 'adventure') { gameId = picked; state.scene = 'title' }
  else if (picked === 'puzzle') { /* 새 게임 진입 */ }
  return false
}
```

게임이 셋 이상으로 늘고 각자 씬·루프가 복잡해지면, 그때 게임마다
`{ init, update, render }` 를 갖는 모듈로 쪼개는 것이 낫다. 둘일 때 미리 그
추상을 만들 필요는 없다.

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
- [ ] `tests/hub.test.ts` 통과 — 카드가 화면 안에 들어가고 키가 안 겹치는지
- [ ] 진행도 키가 다른 게임과 겹치지 않는지
- [ ] 새 스프라이트가 있으면 `REQUIRED_FRAMES` 에 등록
- [ ] `npm test && npm run lint && npm run build`
