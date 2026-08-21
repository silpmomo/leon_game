import { beforeEach, describe, expect, it } from 'vitest'
import { newGameState, updateFrame } from '../src/game/update'
import { resolveHazards } from '../src/game/rules'
import { createEnemy, updateEnemy, ENEMY_TUNING } from '../src/world/entities'
import { resizePlayer } from '../src/world/player'
import { isDeadly, isSpike, isSpring, parseTiles, solidAt } from '../src/world/tilemap'
import { TILE, TUNING } from '../src/engine/tuning'
import { EMPTY_INPUT, type GameState, type InputState, type LevelData } from '../src/types'

const DT = 1 / 60
const input = (o: Partial<InputState> = {}): InputState => ({ ...EMPTY_INPUT, ...o })

function level(tiles: string[], over: Partial<LevelData> = {}): LevelData {
  return {
    name: 't',
    id: 't',
    theme: 'day',
    width: tiles[0]!.length,
    height: tiles.length,
    spawn: { x: 1, y: tiles.length - 3 },
    goal: { x: tiles[0]!.length - 2, flagTop: 1 },
    tiles,
    entities: [],
    checkpoints: [],
    ...over,
  }
}

describe('타일 분류', () => {
  it('가시·용암은 solid 가 아니다 (통과는 된다)', () => {
    const { grid } = parseTiles(['....', '^~..', '####'])
    expect(solidAt(grid, 0, 1)).toBe(false)
    expect(solidAt(grid, 1, 1)).toBe(false)
  })

  it('점프대는 solid 다 (밟고 설 수 있다)', () => {
    const { grid } = parseTiles(['....', 'S...', '####'])
    expect(solidAt(grid, 0, 1)).toBe(true)
  })

  it('분류 함수가 맞다', () => {
    expect(isSpike('^')).toBe(true)
    expect(isSpike('#')).toBe(false)
    expect(isDeadly('~')).toBe(true)
    expect(isDeadly('^')).toBe(false)
    expect(isSpring('S')).toBe(true)
    expect(isSpring('#')).toBe(false)
  })
})

describe('용암 — 닿으면 즉사', () => {
  let s: GameState
  beforeEach(() => {
    s = newGameState(level(['......', '......', '......', '~~~~~~', '~~~~~~'], {
      spawn: { x: 1, y: 2 },
    }), 'practice')
  })

  it('용암에 닿으면 die 가 나온다', () => {
    s.player.y = 3 * TILE
    expect(resolveHazards(s)).toContain('die')
  })

  it('무적 중에도 죽는다', () => {
    s.player.invulnMs = 1000
    s.player.y = 3 * TILE
    expect(resolveHazards(s)).toContain('die')
  })

  it('큰 상태여도 죽는다 (작아지는 게 아니다)', () => {
    resizePlayer(s.player, 'big')
    s.player.y = 3 * TILE
    expect(resolveHazards(s)).toContain('die')
  })

  it('떨어져 있으면 아무 일도 없다', () => {
    s.player.y = 0
    expect(resolveHazards(s)).toEqual([])
  })
})

describe('가시 — 닿으면 피격', () => {
  let s: GameState
  beforeEach(() => {
    s = newGameState(level(['......', '......', '^^^^^^', '######'], {
      spawn: { x: 1, y: 1 },
    }), 'practice')
  })

  it('작은 상태로 닿으면 죽는다', () => {
    s.player.y = 2 * TILE
    expect(resolveHazards(s)).toContain('die')
  })

  it('큰 상태로 닿으면 작아지고 무적이 걸린다', () => {
    resizePlayer(s.player, 'big')
    s.player.y = 2 * TILE - 8
    const ev = resolveHazards(s)
    expect(ev).toContain('hurt')
    expect(s.player.power).toBe('small')
    expect(s.player.invulnMs).toBe(TUNING.invulnMs)
  })

  it('무적 중에는 닿아도 무사하다', () => {
    resizePlayer(s.player, 'big')
    s.player.invulnMs = 500
    s.player.y = 2 * TILE - 8
    expect(resolveHazards(s)).toEqual([])
    expect(s.player.power).toBe('big')
  })
})

describe('점프대 — 최고 점프보다 높이 튕긴다', () => {
  const tiles = ['..........', '..........', '..........', '..........', '....S.....', '##########']

  it('밟으면 spring 이벤트와 함께 크게 튕긴다', () => {
    const s = newGameState(level(tiles, { spawn: { x: 4, y: 3 } }), 'practice')
    let sprung = false
    for (let i = 0; i < 120 && !sprung; i++) {
      sprung = updateFrame(s, input(), DT).includes('spring')
    }
    expect(sprung).toBe(true)
    expect(s.player.vy).toBe(TUNING.springVel)
  })

  it('튕김 속도가 점프 속도보다 크다', () => {
    expect(Math.abs(TUNING.springVel)).toBeGreaterThan(Math.abs(TUNING.jumpVel))
  })

  it('점프대 위로 오르는 높이가 일반 점프보다 높다', () => {
    const springH = TUNING.springVel ** 2 / (2 * TUNING.gravityFall)
    const jumpH = TUNING.jumpVel ** 2 / (2 * TUNING.gravityRise)
    expect(springH).toBeGreaterThan(jumpH)
  })
})

describe('나는 적', () => {
  // 실제 레벨처럼 바닥을 row 10·11 에 둔다. 얕은 격자에 두면 사인 진폭이
  // 바닥에 닿아 벽 충돌로 방향이 뒤집힌다.
  const TALL = [
    '..................',
    '..................',
    '..................',
    '..................',
    '..................',
    '..................',
    '..................',
    '..................',
    '..................',
    '..................',
    '##################',
    '##################',
  ]
  const grid = parseTiles(TALL).grid
  const far = newGameState(level(['..........', '##########', '##########']), 'practice').player

  it('중력을 받지 않고 제 높이를 유지한다', () => {
    const e = createEnemy('flyer', 8, 5, -1)
    e.active = true
    const y0 = e.homeY
    for (let i = 0; i < 300; i++) updateEnemy(e, grid, far, DT)
    // 사인 진폭 안에서만 움직인다
    expect(Math.abs(e.y - y0)).toBeLessThanOrEqual(ENEMY_TUNING.flyerAmpTiles * TILE + 1)
    expect(e.onGround).toBe(false)
  })

  it('상하로 오르내린다', () => {
    const e = createEnemy('flyer', 8, 5, -1)
    e.active = true
    const seen: number[] = []
    for (let i = 0; i < 240; i++) {
      updateEnemy(e, grid, far, DT)
      seen.push(e.y)
    }
    expect(Math.max(...seen) - Math.min(...seen)).toBeGreaterThan(TILE)
  })

  it('가로로 이동한다', () => {
    const e = createEnemy('flyer', 8, 5, -1)
    e.active = true
    const x0 = e.x
    for (let i = 0; i < 60; i++) updateEnemy(e, grid, far, DT)
    expect(e.x).toBeLessThan(x0)
  })

  it('밟을 수 있다', () => {
    const s = newGameState(level(TALL, {
      entities: [{ type: 'flyer', x: 8, y: 5, dir: -1 }],
    }), 'practice')
    const e = s.enemies[0]!
    e.active = true
    s.player.x = e.x
    s.player.y = e.y - s.player.h + 2
    s.player.vy = 100
    const ev = updateFrame(s, input(), DT)
    expect(ev).toContain('stomp')
  })
})

describe('보스', () => {
  const grid = parseTiles([
    '..................................',
    '..................................',
    '..................................',
    '..................................',
    '##################################',
  ]).grid

  it('hp 5로 시작한다', () => {
    expect(createEnemy('boss', 10, 3, -1).hp).toBe(5)
    expect(ENEMY_TUNING.bossHp).toBe(5)
  })

  it('밟을 수 없다 (밟으면 피격)', () => {
    const s = newGameState(level([
      '..................................',
      '..................................',
      '..................................',
      '..................................',
      '##################################',
    ], { entities: [{ type: 'boss', x: 12, y: 3, dir: -1 }] }), 'practice')
    resizePlayer(s.player, 'big')
    const e = s.enemies[0]!
    e.active = true
    s.player.x = e.x + 4
    s.player.y = e.y - s.player.h + 2
    s.player.vy = 100
    const ev = updateFrame(s, input(), DT)
    expect(ev).not.toContain('stomp')
    expect(ev).toContain('hurt')
  })

  it('플레이어가 가까우면 쫓아온다', () => {
    const e = createEnemy('boss', 20, 3, -1)
    e.active = true
    const near = newGameState(level([
      '..................................',
      '..................................',
      '..................................',
      '..................................',
      '##################################',
    ]), 'practice').player
    // 감지 범위 9타일 안으로 들어가야 움직인다
    near.x = 14 * TILE
    const x0 = e.x
    for (let i = 0; i < 60; i++) updateEnemy(e, grid, near, DT)
    expect(e.x).toBeLessThan(x0)
  })

  it('감지 범위 밖이면 가만히 있는다', () => {
    const e = createEnemy('boss', 20, 3, -1)
    e.active = true
    const far2 = createEnemy('broccoli', 0, 3, 1) as unknown as never
    const x0 = e.x
    for (let i = 0; i < 30; i++) updateEnemy(e, grid, far2, DT)
    expect(e.x).toBe(x0)
  })

  it('주기적으로 크게 뛴다', () => {
    const e = createEnemy('boss', 20, 3, -1)
    e.active = true
    const near = createEnemy('broccoli', 10, 3, 1) as unknown as never
    let jumped = false
    for (let i = 0; i < 400 && !jumped; i++) {
      updateEnemy(e, grid, near, DT)
      if (!e.onGround && e.vy < 0) jumped = true
    }
    expect(jumped).toBe(true)
  })

  it('피격 쿨다운이 있어 한 프레임에 여러 발을 맞지 않는다', () => {
    expect(ENEMY_TUNING.bossHitCooldownMs).toBeGreaterThan(0)
  })
})
