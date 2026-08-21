import { describe, expect, it } from 'vitest'
import {
  ENEMY_SIZE,
  ENEMY_TUNING,
  activateVisible,
  createBall,
  createEnemy,
  createItem,
  createPlatform,
  spawnFromLevel,
  updateBall,
  updateEnemy,
  updateItem,
  updatePlatform,
} from '../src/world/entities'
import { parseTiles } from '../src/world/tilemap'
import { createPlayer } from '../src/world/player'
import { TILE } from '../src/engine/tuning'
import type { LevelEntity, TileGrid } from '../src/types'

const DT = 1 / 60

/** 좌우 끝에 벽이 있는 복도 */
function corridor(): TileGrid {
  return parseTiles([
    '..................',
    '..................',
    '#................#',
    '##################',
  ]).grid
}

/** 왼쪽 6타일만 지면, 나머지는 허공 */
function cliff(): TileGrid {
  return parseTiles([
    '..................',
    '..................',
    '..................',
    '######............',
  ]).grid
}

const farPlayer = () => createPlayer(60, 2)

const platformDef = (axis: 'x' | 'y'): Extract<LevelEntity, { type: 'platform' }> => ({
  type: 'platform',
  x: 10,
  y: 5,
  axis,
  range: 2,
  speed: 40,
})

describe('createEnemy', () => {
  it('종류별 크기가 스펙과 같다', () => {
    expect(ENEMY_SIZE.broccoli).toEqual({ w: 12, h: 12 })
    expect(ENEMY_SIZE.soup).toEqual({ w: 14, h: 12 })
    expect(ENEMY_SIZE.crocodile).toEqual({ w: 26, h: 10 })
  })

  it('타일 위에 발을 붙이고 생성된다', () => {
    const e = createEnemy('broccoli', 5, 2, -1)
    expect(e.y + e.h).toBe(3 * TILE)
    expect(e.homeX).toBe(e.x)
    expect(e.active).toBe(false)
    expect(e.alive).toBe(true)
  })

  it('악어만 hp 2로 시작한다', () => {
    expect(createEnemy('crocodile', 5, 2, -1).hp).toBe(ENEMY_TUNING.crocHp)
    expect(createEnemy('broccoli', 5, 2, -1).hp).toBe(1)
    expect(createEnemy('soup', 5, 2, -1).hp).toBe(1)
  })
})

describe('브로콜리', () => {
  it('활성화되면 지정 방향으로 걷는다', () => {
    const grid = corridor()
    const e = createEnemy('broccoli', 8, 2, -1)
    e.active = true
    const x0 = e.x
    for (let i = 0; i < 30; i++) updateEnemy(e, grid, farPlayer(), DT)
    expect(e.x).toBeLessThan(x0)
    expect(Math.abs(e.vx)).toBeCloseTo(ENEMY_TUNING.broccoliSpeed, 0)
  })

  it('벽에 막히면 방향을 뒤집는다', () => {
    const grid = corridor()
    const e = createEnemy('broccoli', 1, 2, -1)
    e.active = true
    for (let i = 0; i < 120; i++) updateEnemy(e, grid, farPlayer(), DT)
    expect(e.dir).toBe(1)
  })

  it('절벽에서는 돌아서지 않고 떨어진다 (원작 굼바와 동일)', () => {
    const grid = cliff()
    const e = createEnemy('broccoli', 5, 2, 1)
    e.active = true
    const y0 = e.y
    for (let i = 0; i < 120; i++) updateEnemy(e, grid, farPlayer(), DT)
    expect(e.y).toBeGreaterThan(y0)
    expect(e.dir).toBe(1)
  })

  it('비활성 상태에서는 움직이지 않는다', () => {
    const grid = corridor()
    const e = createEnemy('broccoli', 8, 2, -1)
    const x0 = e.x
    for (let i = 0; i < 30; i++) updateEnemy(e, grid, farPlayer(), DT)
    expect(e.x).toBe(x0)
  })

  it('죽은 적은 갱신되지 않는다', () => {
    const grid = corridor()
    const e = createEnemy('broccoli', 8, 2, -1)
    e.active = true
    e.alive = false
    const x0 = e.x
    updateEnemy(e, grid, farPlayer(), DT)
    expect(e.x).toBe(x0)
  })
})

describe('미역국', () => {
  it('가로로 움직이지 않는다', () => {
    const grid = corridor()
    const e = createEnemy('soup', 8, 2, -1)
    e.active = true
    const x0 = e.x
    for (let i = 0; i < 200; i++) updateEnemy(e, grid, farPlayer(), DT)
    expect(e.x).toBe(x0)
  })

  it('주기적으로 튀어오른다', () => {
    const grid = corridor()
    const e = createEnemy('soup', 8, 2, -1)
    e.active = true
    let peak = e.y
    let jumps = 0
    let wasGround = true
    for (let i = 0; i < 400; i++) {
      updateEnemy(e, grid, farPlayer(), DT)
      peak = Math.min(peak, e.y)
      if (wasGround && !e.onGround) jumps += 1
      wasGround = e.onGround
    }
    expect(jumps).toBeGreaterThanOrEqual(2)
    expect(peak).toBeLessThan(3 * TILE - e.h)
  })
})

describe('악어', () => {
  it('멀리 있으면 돌진하지 않는다', () => {
    const grid = corridor()
    const e = createEnemy('crocodile', 8, 2, -1)
    e.active = true
    const x0 = e.x
    for (let i = 0; i < 60; i++) updateEnemy(e, grid, farPlayer(), DT)
    expect(e.x).toBe(x0)
  })

  it('8타일 안으로 들어오면 돌진한다', () => {
    const grid = corridor()
    const e = createEnemy('crocodile', 12, 2, -1)
    e.active = true
    const near = createPlayer(6, 2)
    const x0 = e.x
    for (let i = 0; i < 30; i++) updateEnemy(e, grid, near, DT)
    expect(e.x).toBeLessThan(x0)
    expect(Math.abs(e.vx)).toBeCloseTo(ENEMY_TUNING.crocSpeed, 0)
  })

  it('플레이어가 있는 쪽으로 돌아선다', () => {
    const grid = corridor()
    const e = createEnemy('crocodile', 8, 2, -1)
    e.active = true
    updateEnemy(e, grid, createPlayer(14, 2), DT)
    expect(e.dir).toBe(1)
  })

  it('돌진을 시작하면 플레이어가 멀어져도 계속 간다', () => {
    const grid = corridor()
    const e = createEnemy('crocodile', 12, 2, -1)
    e.active = true
    for (let i = 0; i < 10; i++) updateEnemy(e, grid, createPlayer(6, 2), DT)
    const x1 = e.x
    for (let i = 0; i < 20; i++) updateEnemy(e, grid, farPlayer(), DT)
    expect(e.x).toBeLessThan(x1)
  })

  it('벽에 막히면 방향을 뒤집는다', () => {
    const grid = corridor()
    const e = createEnemy('crocodile', 2, 2, -1)
    e.active = true
    for (let i = 0; i < 120; i++) updateEnemy(e, grid, createPlayer(4, 2), DT)
    expect(e.dir).toBe(1)
  })
})

describe('이동발판', () => {
  it('가로 발판은 원점 ±range 타일을 왕복한다', () => {
    const pf = createPlatform(platformDef('x'))
    const seen: number[] = []
    for (let i = 0; i < 600; i++) {
      updatePlatform(pf, DT)
      seen.push(pf.x)
    }
    expect(Math.min(...seen)).toBeGreaterThanOrEqual(pf.originX - 2 * TILE - 1)
    expect(Math.max(...seen)).toBeLessThanOrEqual(pf.originX + 2 * TILE + 1)
    expect(Math.max(...seen) - Math.min(...seen)).toBeGreaterThan(2 * TILE)
  })

  it('세로 발판은 y만 움직인다', () => {
    const pf = createPlatform(platformDef('y'))
    const x0 = pf.x
    for (let i = 0; i < 200; i++) updatePlatform(pf, DT)
    expect(pf.x).toBe(x0)
  })

  it('이동량(dx, dy)을 반환한다 — 위에 탄 몸에 더해진다', () => {
    const pf = createPlatform(platformDef('x'))
    const { dx, dy } = updatePlatform(pf, DT)
    expect(Math.abs(dx)).toBeGreaterThan(0)
    expect(dy).toBe(0)
  })

  it('세로 발판의 이동량은 dy에 담긴다', () => {
    const pf = createPlatform(platformDef('y'))
    const { dx, dy } = updatePlatform(pf, DT)
    expect(dx).toBe(0)
    expect(Math.abs(dy)).toBeGreaterThan(0)
  })

  it('발판 폭은 3타일이다', () => {
    expect(createPlatform(platformDef('x')).w).toBe(3 * TILE)
  })
})

describe('축구공', () => {
  it('플레이어가 보는 방향으로 날아간다', () => {
    const grid = corridor()
    const p = createPlayer(4, 2)
    p.facing = 1
    const b = createBall(p)
    expect(b.vx).toBeGreaterThan(0)
    const x0 = b.x
    updateBall(b, grid, DT)
    expect(b.x).toBeGreaterThan(x0)
  })

  it('왼쪽을 보면 왼쪽으로 날아간다', () => {
    const p = createPlayer(8, 2)
    p.facing = -1
    expect(createBall(p).vx).toBeLessThan(0)
  })

  it('바닥에서 튕긴다', () => {
    const grid = corridor()
    const p = createPlayer(4, 1)
    const b = createBall(p)
    let bounced = false
    for (let i = 0; i < 200 && !bounced; i++) {
      updateBall(b, grid, DT)
      if (b.bounces > 0) bounced = true
    }
    expect(bounced).toBe(true)
  })

  it('3회 튕기면 사라진다', () => {
    const grid = corridor()
    const p = createPlayer(4, 1)
    const b = createBall(p)
    for (let i = 0; i < 2000 && b.alive; i++) updateBall(b, grid, DT)
    expect(b.alive).toBe(false)
    expect(b.bounces).toBeGreaterThanOrEqual(3)
  })

  it('벽에 닿으면 즉시 사라진다', () => {
    const grid = corridor()
    const p = createPlayer(15, 2)
    p.facing = 1
    const b = createBall(p)
    for (let i = 0; i < 200 && b.alive; i++) updateBall(b, grid, DT)
    expect(b.alive).toBe(false)
  })

  it('죽은 공은 갱신되지 않는다', () => {
    const grid = corridor()
    const b = createBall(createPlayer(4, 2))
    b.alive = false
    const x0 = b.x
    updateBall(b, grid, DT)
    expect(b.x).toBe(x0)
  })
})

describe('아이템', () => {
  it('복숭아는 굴러가고 벽에서 방향을 바꾼다', () => {
    const grid = corridor()
    const it = createItem('peach', 1, 2, -1)
    for (let i = 0; i < 200; i++) updateItem(it, grid, DT)
    expect(it.vx).toBeGreaterThan(0)
  })

  it('축구공 아이템은 제자리에 있다', () => {
    const grid = corridor()
    const it = createItem('ball', 8, 2, 1)
    const x0 = it.x
    for (let i = 0; i < 60; i++) updateItem(it, grid, DT)
    expect(it.x).toBe(x0)
  })

  it('먹은 아이템은 갱신되지 않는다', () => {
    const grid = corridor()
    const it = createItem('peach', 8, 2, 1)
    it.taken = true
    const x0 = it.x
    updateItem(it, grid, DT)
    expect(it.x).toBe(x0)
  })

  it('아이템도 중력을 받아 바닥에 정착한다', () => {
    const grid = corridor()
    const it = createItem('peach', 8, 0, 1)
    for (let i = 0; i < 120; i++) updateItem(it, grid, DT)
    expect(it.onGround).toBe(true)
    expect(it.y + it.h).toBe(3 * TILE)
  })
})

describe('spawnFromLevel / activateVisible', () => {
  const defs: LevelEntity[] = [
    { type: 'broccoli', x: 5, y: 2, dir: -1 },
    { type: 'crocodile', x: 40, y: 2 },
    { type: 'platform', x: 20, y: 5, axis: 'x', range: 2, speed: 40 },
  ]

  it('적과 발판을 분리해 만든다', () => {
    const { enemies, platforms } = spawnFromLevel(defs)
    expect(enemies).toHaveLength(2)
    expect(platforms).toHaveLength(1)
  })

  it('dir이 없으면 -1이 기본이다', () => {
    const { enemies } = spawnFromLevel(defs)
    expect(enemies[1]!.dir).toBe(-1)
  })

  it('카메라 시야에 들어온 적만 활성화한다', () => {
    const { enemies } = spawnFromLevel(defs)
    activateVisible(enemies, 0)
    expect(enemies[0]!.active).toBe(true)
    expect(enemies[1]!.active).toBe(false)
  })

  it('카메라가 나아가면 뒤쪽 적도 활성화된다', () => {
    const { enemies } = spawnFromLevel(defs)
    activateVisible(enemies, 40 * TILE)
    expect(enemies[1]!.active).toBe(true)
  })

  it('한번 활성화되면 화면을 벗어나도 유지된다', () => {
    const { enemies } = spawnFromLevel(defs)
    activateVisible(enemies, 0)
    activateVisible(enemies, 100 * TILE)
    expect(enemies[0]!.active).toBe(true)
  })

  it('빈 목록도 처리한다', () => {
    const { enemies, platforms } = spawnFromLevel([])
    expect(enemies).toEqual([])
    expect(platforms).toEqual([])
  })
})
