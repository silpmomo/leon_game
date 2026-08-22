import { describe, expect, it } from 'vitest'
import type { BestRecord, Progress } from '../src/types'
import { VIEW_H, VIEW_W } from '../src/engine/tuning'
import { BOMB_RECT, bombHitTest } from '../src/ui/skyControls'
import {
  SKY_STAGE_IDS, skyCellRect, skyHubHitTest, skyModeHitTest,
  skyResultHitTest, skyStageHitTest,
} from '../src/ui/skyUi'
import { MUTE_RECT } from '../src/render/hud'
import { SKY_STAGES } from '../src/sky/stages'
import { bossHome, bossHpRatio, bossFinished, damageBoss, spawnBoss } from '../src/sky/boss'
import { BOSS_DIE_MS, SKY_H, SKY_W } from '../src/sky/tuning'

const done: BestRecord = { cleared: true, bestScore: 1, bestTimeMs: 1, fewestDeaths: 0 }

describe('궁극기 버튼', () => {
  it('화면 안에 있다', () => {
    expect(BOMB_RECT.x).toBeGreaterThanOrEqual(0)
    expect(BOMB_RECT.y).toBeGreaterThanOrEqual(0)
    expect(BOMB_RECT.x + BOMB_RECT.w).toBeLessThanOrEqual(VIEW_W)
    expect(BOMB_RECT.y + BOMB_RECT.h).toBeLessThanOrEqual(VIEW_H)
  })

  it('오른쪽 아래 구석이다 — 기존 게임 버튼과 같은 손 위치', () => {
    expect(BOMB_RECT.x).toBeGreaterThan(VIEW_W * 0.7)
    expect(BOMB_RECT.y).toBeGreaterThan(VIEW_H * 0.5)
  })

  it('가운데를 누르면 잡힌다', () => {
    expect(bombHitTest(BOMB_RECT.x + BOMB_RECT.w / 2, BOMB_RECT.y + BOMB_RECT.h / 2)).toBe(true)
  })

  it('보이는 원보다 넉넉히 잡는다 — 아이 손가락은 정확하지 않다', () => {
    expect(bombHitTest(BOMB_RECT.x - 3, BOMB_RECT.y + BOMB_RECT.h / 2)).toBe(true)
  })

  it('반대쪽 화면은 안 잡힌다', () => {
    expect(bombHitTest(20, 20)).toBe(false)
    expect(bombHitTest(VIEW_W / 2, VIEW_H / 2)).toBe(false)
  })

  it('음소거 버튼과 겹치지 않는다', () => {
    const overlap = BOMB_RECT.x < MUTE_RECT.x + MUTE_RECT.w
      && MUTE_RECT.x < BOMB_RECT.x + BOMB_RECT.w
      && BOMB_RECT.y < MUTE_RECT.y + MUTE_RECT.h
      && MUTE_RECT.y < BOMB_RECT.y + BOMB_RECT.h
    expect(overlap).toBe(false)
  })
})

describe('타이틀', () => {
  it('좌상단으로 허브에 돌아간다', () => {
    expect(skyHubHitTest(20, 12)).toBe(true)
    expect(skyHubHitTest(VIEW_W / 2, VIEW_H / 2)).toBe(false)
  })

  it('연습과 도전을 고를 수 있다', () => {
    const found = new Set<string>()
    for (let x = 0; x < VIEW_W; x += 3) {
      for (let y = 0; y < VIEW_H; y += 3) {
        const m = skyModeHitTest(x, y)
        if (m) found.add(m)
      }
    }
    expect(found).toEqual(new Set(['practice', 'challenge']))
  })
})

describe('탄 고르기', () => {
  it('열 칸이 서로 겹치지 않는다', () => {
    for (let i = 0; i < 10; i++) {
      for (let j = i + 1; j < 10; j++) {
        const a = skyCellRect(i)
        const b = skyCellRect(j)
        const hit = a.x < b.x + b.w && b.x < a.x + a.w
          && a.y < b.y + b.h && b.y < a.y + a.h
        expect(hit, `${i}번과 ${j}번이 겹친다`).toBe(false)
      }
    }
  })

  it('열 칸 모두 화면 안에 있다', () => {
    for (let i = 0; i < 10; i++) {
      const r = skyCellRect(i)
      expect(r.x).toBeGreaterThanOrEqual(0)
      expect(r.x + r.w).toBeLessThanOrEqual(VIEW_W)
      expect(r.y + r.h).toBeLessThanOrEqual(VIEW_H)
    }
  })

  it('1탄은 늘 열려 있다', () => {
    const r = skyCellRect(0)
    expect(skyStageHitTest(r.x + 5, r.y + 5, {})).toBe(0)
  })

  it('앞 탄을 깨야 다음 탄이 열린다', () => {
    const r = skyCellRect(1)
    expect(skyStageHitTest(r.x + 5, r.y + 5, {})).toBeNull()
    const p: Progress = { [SKY_STAGE_IDS[0]!]: done }
    expect(skyStageHitTest(r.x + 5, r.y + 5, p)).toBe(1)
  })

  it('칸 밖은 잡히지 않는다', () => {
    expect(skyStageHitTest(2, VIEW_H - 4, {})).toBeNull()
  })

  it('id 목록이 스테이지와 같다', () => {
    expect(SKY_STAGE_IDS).toEqual(SKY_STAGES.map((s) => s.id))
  })
})

describe('결과 화면', () => {
  it('다음 탄이 있으면 버튼이 셋', () => {
    const seen = new Set<string>()
    for (let x = 0; x < VIEW_W; x += 3) {
      for (let y = 0; y < VIEW_H; y += 3) {
        const a = skyResultHitTest(x, y, true)
        if (a) seen.add(a)
      }
    }
    expect(seen).toEqual(new Set(['next', 'again', 'select']))
  })

  it('마지막 탄이면 다음 버튼이 없다', () => {
    const seen = new Set<string>()
    for (let x = 0; x < VIEW_W; x += 3) {
      for (let y = 0; y < VIEW_H; y += 3) {
        const a = skyResultHitTest(x, y, false)
        if (a) seen.add(a)
      }
    }
    expect(seen).toEqual(new Set(['again', 'select']))
  })
})

describe('보스 상태', () => {
  const spec = SKY_STAGES[4]!.boss

  it('오른쪽에 자리잡되 화면 안에 다 들어온다', () => {
    const home = bossHome(spec.w)
    expect(home + spec.w / 2).toBeLessThanOrEqual(SKY_W)
    expect(home).toBeGreaterThan(SKY_W * 0.5)
  })

  it('체력 비율이 페이즈를 넘어가며 계속 줄어든다', () => {
    const b = spawnBoss(spec)
    b.enterMs = 0
    let prev = bossHpRatio(b)
    expect(prev).toBeCloseTo(1, 5)
    for (let i = 0; i < 40; i++) {
      const r = damageBoss(b, 200)
      b.morphMs = 0
      if (r === 'dead') break
      const now = bossHpRatio(b)
      expect(now).toBeLessThan(prev + 1e-9)
      prev = now
    }
    expect(bossHpRatio(b)).toBeCloseTo(0, 3)
  })

  it('격파 연출이 끝나야 죽은 것으로 친다', () => {
    const b = spawnBoss(spec)
    b.enterMs = 0
    b.phase = b.phases.length - 1
    b.hp = 1
    damageBoss(b, 10)
    expect(bossFinished(b)).toBe(false)
    b.dieMs = 0
    expect(bossFinished(b)).toBe(true)
    expect(BOSS_DIE_MS).toBeGreaterThan(0)
  })

  it('세로 화면 밖으로 나가지 않는다', () => {
    const b = spawnBoss(spec)
    b.enterMs = 0
    expect(b.y).toBeGreaterThan(0)
    expect(b.y).toBeLessThan(SKY_H)
  })
})
