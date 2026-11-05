import { describe, expect, it } from 'vitest'
import type { BestRecord, Rect } from '../src/types'
import { VIEW_H, VIEW_W } from '../src/engine/tuning'
import { MUTE_RECT } from '../src/render/hud'
import { EXIT_RECT } from '../src/render/arena'
import {
  ARENA_BACK_RECT, ARENA_MAP_IDS, FIRE_RECT, JOY_ZONE_X, SUPER_RECT,
  arenaCellRect, arenaMapHitTest, arenaModeHitTest, arenaModeRects,
  arenaResultHitTest, fireHitTest, superHitTest,
} from '../src/ui/arenaUi'
import { ARENA_MAPS } from '../src/arena/maps'
import { GAMES } from '../src/games/registry'

const done: BestRecord = { cleared: true, bestScore: 1, bestTimeMs: 1, fewestDeaths: 0 }
const onScreen = (r: Rect) =>
  r.x >= 0 && r.y >= 0 && r.x + r.w <= VIEW_W && r.y + r.h <= VIEW_H
const overlap = (a: Rect, b: Rect) =>
  a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h
const mid = (r: Rect) => [r.x + r.w / 2, r.y + r.h / 2] as const

describe('숲속대결 조작 버튼', () => {
  it('버튼이 화면 안에 있고 서로·음소거와 안 겹친다', () => {
    for (const r of [FIRE_RECT, SUPER_RECT, EXIT_RECT]) expect(onScreen(r)).toBe(true)
    expect(overlap(FIRE_RECT, SUPER_RECT)).toBe(false)
    expect(overlap(FIRE_RECT, MUTE_RECT)).toBe(false)
    expect(overlap(SUPER_RECT, MUTE_RECT)).toBe(false)
  })

  it('공격 버튼은 오른쪽 아래 — 조이스틱 구역과 안 겹친다', () => {
    expect(FIRE_RECT.x).toBeGreaterThan(VIEW_W * 0.7)
    expect(FIRE_RECT.y).toBeGreaterThan(VIEW_H * 0.5)
    expect(SUPER_RECT.x).toBeGreaterThan(JOY_ZONE_X)
  })

  it('가운데를 누르면 잡히고, 넉넉히 잡는다', () => {
    expect(fireHitTest(...mid(FIRE_RECT))).toBe(true)
    expect(fireHitTest(FIRE_RECT.x - 3, FIRE_RECT.y + FIRE_RECT.h / 2)).toBe(true)
    expect(superHitTest(...mid(SUPER_RECT))).toBe(true)
    expect(fireHitTest(20, 20)).toBe(false)
  })
})

describe('숲속대결 화면', () => {
  it('모드 버튼 두 개가 잡힌다', () => {
    const r = arenaModeRects()
    expect(arenaModeHitTest(...mid(r.practice))).toBe('practice')
    expect(arenaModeHitTest(...mid(r.challenge))).toBe('challenge')
    expect(overlap(r.practice, ARENA_BACK_RECT)).toBe(false)
  })

  it('판 칸이 화면 안에 있고 안 겹친다', () => {
    for (let i = 0; i < ARENA_MAPS.length; i++) {
      expect(onScreen(arenaCellRect(i)), `${i}`).toBe(true)
      for (let j = i + 1; j < ARENA_MAPS.length; j++) {
        expect(overlap(arenaCellRect(i), arenaCellRect(j))).toBe(false)
      }
    }
  })

  it('1판은 열려 있고, 1등을 해야 다음 판이 열린다', () => {
    expect(arenaMapHitTest(...mid(arenaCellRect(0)), {})).toBe(0)
    expect(arenaMapHitTest(...mid(arenaCellRect(1)), {})).toBeNull()
    expect(arenaMapHitTest(...mid(arenaCellRect(1)), { [ARENA_MAP_IDS[0]!]: done })).toBe(1)
  })

  it('결과 버튼 — 마지막 판에는 다음이 없다', () => {
    const y = VIEW_H - 44 + 13
    expect(arenaResultHitTest(VIEW_W / 2 - 102, y, true)).toBe('next')
    expect(arenaResultHitTest(VIEW_W / 2 - 51, y, false)).toBe('again')
  })
})

describe('허브 등록', () => {
  it('세 번째 게임은 숲속대결이다', () => {
    const g = GAMES.find((x) => x.id === 'arena')
    expect(g?.title).toBe('리온의 숲속대결')
    expect(g?.status).toBe('ready')
  })
})
