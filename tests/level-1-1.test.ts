import { describe, expect, it } from 'vitest'
import raw from '../src/levels/1-1.json'
import { maxPitWidth, validateLevel } from '../src/levels/schema'
import { parseTiles, solidAt, tileAt } from '../src/world/tilemap'
import { TILE, derive } from '../src/engine/tuning'
import { newGameState, updateFrame } from '../src/game/update'
import { EMPTY_INPUT, type LevelData } from '../src/types'

const level = raw as LevelData
const { grid } = parseTiles(level.tiles)

describe('1-1 검증', () => {
  it('7규칙을 모두 통과한다', () => {
    const issues = validateLevel(level)
    expect(issues.map((i) => `규칙 ${i.rule}: ${i.message}`)).toEqual([])
  })

  it('200 x 12 격자다', () => {
    expect(level.width).toBe(200)
    expect(level.height).toBe(12)
    expect(level.tiles).toHaveLength(12)
    for (const row of level.tiles) expect(row).toHaveLength(200)
  })
})

describe('구간 설계 의도', () => {
  it('D구간 첫 구덩이는 3타일 — 걷기로 넘어간다', () => {
    for (let tx = 76; tx <= 78; tx++) expect(solidAt(grid, tx, 11)).toBe(false)
    expect(solidAt(grid, 75, 11)).toBe(true)
    expect(solidAt(grid, 79, 11)).toBe(true)
    expect(derive().walkReach).toBeGreaterThan(3 * TILE)
  })

  it('D구간 두 번째 구덩이는 5타일 — 걷기로는 못 넘고 달려야 한다', () => {
    for (let tx = 84; tx <= 88; tx++) expect(solidAt(grid, tx, 11)).toBe(false)
    expect(solidAt(grid, 83, 11)).toBe(true)
    expect(solidAt(grid, 89, 11)).toBe(true)
    expect(derive().walkReach).toBeLessThan(5 * TILE)
    expect(derive().runReach).toBeGreaterThan(5 * TILE)
  })

  it('D구간에는 적이 없다 — 달리기 학습에 방해물을 두지 않는다', () => {
    expect(level.entities.filter((e) => e.x >= 70 && e.x <= 91)).toEqual([])
  })

  it('A구간 코인 3개가 점프로 닿는 높이에 있다', () => {
    let coins = 0
    for (let tx = 0; tx <= 23; tx++) {
      for (let ty = 0; ty < 12; ty++) {
        if (level.tiles[ty]![tx] === 'o') {
          coins += 1
          // 지면(row 10) 위로 점프 최고 높이 안에 있어야 한다
          const heightTiles = 10 - ty
          expect(heightTiles * TILE).toBeLessThan(derive().jumpHeight)
        }
      }
    }
    expect(coins).toBe(3)
  })

  it('B구간에 복숭아 블록이 하나 있다', () => {
    let found = 0
    for (let tx = 24; tx <= 47; tx++) {
      for (let ty = 0; ty < 12; ty++) if (tileAt(grid, tx, ty) === '@') found += 1
    }
    expect(found).toBe(1)
  })

  it('축구공 블록이 악어보다 앞에 있다 — 무기를 먼저 준다', () => {
    let ballTx = -1
    for (let tx = 0; tx < 200 && ballTx < 0; tx++) {
      for (let ty = 0; ty < 12; ty++) {
        if (tileAt(grid, tx, ty) === '*') {
          ballTx = tx
          break
        }
      }
    }
    const firstCroc = Math.min(
      ...level.entities.filter((e) => e.type === 'crocodile').map((e) => e.x),
    )
    expect(ballTx).toBeGreaterThan(0)
    expect(ballTx).toBeLessThan(firstCroc)
  })

  it('C구간 파이프는 낮은 것이 먼저 나온다', () => {
    const pipeHeight = (tx: number) => {
      let h = 0
      for (let ty = 0; ty < 12; ty++) {
        const t = tileAt(grid, tx, ty)
        if (t === 'p' || t === '|') h += 1
      }
      return h
    }
    expect(pipeHeight(52)).toBe(2)
    expect(pipeHeight(62)).toBe(4)
  })

  it('E구간 공중 다리 아래로도 지나갈 수 있다 (두 갈래 길)', () => {
    // 다리는 row 6, 바닥은 row 10 → row 7~9 가 비어 있어야 한다
    for (let tx = 97; tx <= 101; tx++) {
      for (let ty = 7; ty <= 9; ty++) expect(solidAt(grid, tx, ty)).toBe(false)
    }
  })

  it('F구간 악어 통로는 천장이 있지만 점프할 여유가 있다', () => {
    // 천장 단단블록은 row 6 → 바닥 row 10 사이 3타일
    expect(solidAt(grid, 121, 6)).toBe(true)
    for (let ty = 7; ty <= 9; ty++) expect(solidAt(grid, 121, ty)).toBe(false)
  })

  it('G구간 10타일 구덩이는 발판 두 개가 덮는다', () => {
    for (let tx = 148; tx <= 157; tx++) expect(solidAt(grid, tx, 11)).toBe(false)
    const plats = level.entities.filter((e) => e.type === 'platform')
    expect(plats).toHaveLength(2)
    expect(maxPitWidth()).toBeLessThan(10) // 발판 없으면 규칙 4 위반일 폭
  })

  it('H구간 계단은 오른쪽으로 올라간다', () => {
    const stack = (tx: number) => {
      let n = 0
      for (let ty = 0; ty < 12; ty++) if (solidAt(grid, tx, ty)) n += 1
      return n
    }
    expect(stack(180)).toBe(3)
    expect(stack(181)).toBe(4)
    expect(stack(182)).toBe(5)
    expect(stack(183)).toBe(6)
  })

  it('H구간이 적 밀도가 가장 높다', () => {
    const count = (a: number, b: number) =>
      level.entities.filter((e) => e.type !== 'platform' && e.x >= a && e.x <= b).length
    const h = count(168, 189)
    for (const [a, b] of [
      [0, 23],
      [24, 47],
      [48, 69],
      [92, 117],
      [118, 141],
    ] as const) {
      expect(h).toBeGreaterThan(count(a, b))
    }
  })

  it('I구간(골)에는 적이 없다', () => {
    expect(level.entities.filter((e) => e.x >= 190)).toEqual([])
  })

  it('체크포인트는 각 구간 입구에 있다', () => {
    expect(level.checkpoints).toEqual([70, 118, 142, 168])
  })

  it('모든 적이 땅 위에 서 있다', () => {
    for (const e of level.entities) {
      if (e.type === 'platform') continue
      expect(solidAt(grid, e.x, e.y + 1), `적 ${e.type}@${e.x} 아래가 허공`).toBe(true)
      expect(solidAt(grid, e.x, e.y), `적 ${e.type}@${e.x} 가 블록 안`).toBe(false)
    }
  })

  it('위험도가 A에서 H로 갈수록 오른다 (구간별 적 수)', () => {
    const count = (a: number, b: number) =>
      level.entities.filter((e) => e.type !== 'platform' && e.x >= a && e.x <= b).length
    expect(count(0, 23)).toBeLessThan(count(168, 189))
    expect(count(190, 199)).toBe(0)
  })
})

/**
 * 레벨이 물리적으로 끝까지 통과 가능한지 본다.
 *
 * 봇은 오른쪽으로만 가며 구덩이·벽·적 앞에서 점프하고, 축구공이 있으면 쏜다.
 * 사람만큼 잘 하지는 못하지만 물리 상수나 지형을 바꿔 클리어가 불가능해지면
 * 이 테스트가 깨진다. 규칙 검증(7규칙)이 잡지 못하는 종류의 사고를 잡는다.
 */
describe('1-1 완주 가능성', () => {
  const SOLID_AHEAD = new Set(['#', 'H', 'p', '|', 'B', 'b', '?', '@', '*'])

  function needsJump(s: ReturnType<typeof newGameState>): boolean {
    const p = s.player
    const aheadTx = Math.floor((p.x + p.w + 8) / TILE)
    const groundGone = level.tiles[10]![aheadTx] !== '#'
    const wall = SOLID_AHEAD.has(level.tiles[9]![aheadTx] ?? '.')
    const enemyNear = s.enemies.some(
      (e) =>
        e.active
        && e.alive
        && e.squashMs === 0
        && e.x > p.x
        && e.x - p.x < 3 * TILE
        && Math.abs(e.y - p.y) < 3 * TILE,
    )
    return groundGone || wall || enemyNear
  }

  /** holdFrames 만큼 점프를 유지하는 봇을 돌려 { 골 도달, 최대 도달 타일 } 반환 */
  function run(holdFrames: number): { reachedGoal: boolean; maxTx: number } {
    const s = newGameState(level, 'practice')
    let hold = 0
    let maxTx = 0

    for (let i = 0; i < 60 * 200; i++) {
      maxTx = Math.max(maxTx, Math.floor((s.player.x + s.player.w / 2) / TILE))

      if (s.player.onGround && needsJump(s)) hold = holdFrames
      const justPressed = hold === holdFrames
      if (hold > 0) hold -= 1

      const ev = updateFrame(
        s,
        {
          ...EMPTY_INPUT,
          right: true,
          jump: hold > 0 || justPressed,
          jumpPressed: justPressed,
          firePressed: s.player.power === 'ball',
        },
        1 / 60,
      )
      if (ev.includes('goal')) return { reachedGoal: true, maxTx }
      if (ev.includes('die')) return { reachedGoal: false, maxTx }
    }
    return { reachedGoal: false, maxTx }
  }

  it('점프를 충분히 길게 누르는 봇은 깃대까지 도달한다', () => {
    const r = run(18)
    expect(r.reachedGoal, `타일 ${r.maxTx} 에서 멈췄다`).toBe(true)
  })

  it('점프를 짧게 누르면 C구간 높은 파이프(타일 62)를 못 넘는다', () => {
    // 의도된 난이도: 낮은 파이프는 짧은 점프로 넘고 높은 파이프는 길게 눌러야 한다
    const r = run(10)
    expect(r.reachedGoal).toBe(false)
    expect(r.maxTx).toBeGreaterThanOrEqual(58)
    expect(r.maxTx).toBeLessThan(70)
  })
})
