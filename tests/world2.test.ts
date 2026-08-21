import { describe, expect, it } from 'vitest'
import { newGameState, updateFrame } from '../src/game/update'
import { canStomp, resolveBalls } from '../src/game/rules'
import { ENEMY_TUNING, createEnemy, createHostileBall, updateEnemy } from '../src/world/entities'
import { createPlayer, resizePlayer, updatePlayer } from '../src/world/player'
import { isIce, parseTiles, solidAt } from '../src/world/tilemap'
import { TILE, TUNING } from '../src/engine/tuning'
import { STAGES, stagesOfWorld } from '../src/levels/index'
import { EMPTY_INPUT, type InputState, type LevelData, type TileGrid } from '../src/types'

const DT = 1 / 60
const input = (o: Partial<InputState> = {}): InputState => ({ ...EMPTY_INPUT, ...o })

const FLAT = [
  '..............................',
  '..............................',
  '..............................',
  '..............................',
  '..............................',
  '..............................',
  '..............................',
  '..............................',
  '..............................',
  '..............................',
  '##############################',
  '##############################',
]
const ICY = FLAT.map((r, i) => (i >= 10 ? 'I'.repeat(30) : r))

function level(tiles: string[], over: Partial<LevelData> = {}): LevelData {
  return {
    name: 't',
    id: 't',
    theme: 'ice',
    width: tiles[0]!.length,
    height: tiles.length,
    spawn: { x: 2, y: 9 },
    goal: { x: tiles[0]!.length - 2, flagTop: 2 },
    tiles,
    entities: [],
    checkpoints: [],
    ...over,
  }
}

/** 지면에 정착시킨 뒤, n프레임 오른쪽으로 달리고 손을 뗀 뒤 멈추기까지의 거리 */
function slideDistance(tiles: string[]): number {
  const grid = parseTiles(tiles).grid
  const p = createPlayer(2, 9)
  for (let i = 0; i < 40; i++) updatePlayer(p, input(), grid, DT)
  for (let i = 0; i < 90; i++) updatePlayer(p, input({ right: true }), grid, DT)
  const x0 = p.x
  for (let i = 0; i < 600 && Math.abs(p.vx) > 0.01; i++) {
    updatePlayer(p, input(), grid, DT)
  }
  return p.x - x0
}

describe('얼음', () => {
  it('얼음은 solid 다 (밟고 설 수 있다)', () => {
    const { grid } = parseTiles(['..', 'I.', '##'])
    expect(solidAt(grid, 0, 1)).toBe(true)
    expect(isIce('I')).toBe(true)
    expect(isIce('#')).toBe(false)
  })

  it('얼음 위에서 손을 떼면 훨씬 멀리 미끄러진다', () => {
    const normal = slideDistance(FLAT)
    const ice = slideDistance(ICY)
    expect(ice).toBeGreaterThan(normal * 3)
  })

  it('일반 땅 정지거리는 물리 계산과 맞는다', () => {
    // 연속 공식은 v^2/(2a) = 150^2/(2*450) = 25px.
    // 고정 timestep 이산 적분이라 정확히 같지는 않다 — 한 프레임 이동량
    // (150/60 = 2.5px) 안에 들어오면 맞는 것이다.
    const expected = TUNING.runMax ** 2 / (2 * TUNING.decel)
    const frameStep = TUNING.runMax * DT
    expect(Math.abs(slideDistance(FLAT) - expected)).toBeLessThan(frameStep)
  })

  it('얼음 정지거리도 물리 계산과 맞는다 (감속만 줄어든다)', () => {
    const expected = TUNING.runMax ** 2 / (2 * TUNING.decel * TUNING.iceDecelScale)
    // 얼음에서는 가속도 줄어 최고 속도에 늦게 닿으므로 계산값 이하가 된다
    expect(slideDistance(ICY)).toBeLessThanOrEqual(expected + 1)
    expect(slideDistance(ICY)).toBeGreaterThan(expected * 0.5)
  })

  it('감속·가속 배율이 1보다 작다', () => {
    expect(TUNING.iceDecelScale).toBeLessThan(1)
    expect(TUNING.iceAccelScale).toBeLessThan(1)
    expect(TUNING.iceDecelScale).toBeGreaterThan(0)
  })

  it('발이 얼음과 일반 땅에 걸치면 미끄러운 쪽을 따른다', () => {
    // 타일 15 부터 얼음. 플레이어(폭 11)를 타일 14~15 에 걸치게 둔다.
    const mixed = FLAT.map((r, i) => (i >= 10 ? '#'.repeat(15) + 'I'.repeat(15) : r))
    const grid = parseTiles(mixed).grid

    const straddle = createPlayer(2, 9)
    for (let i = 0; i < 40; i++) updatePlayer(straddle, input(), grid, DT)
    straddle.x = 15 * TILE - 5 // 오른쪽 끝이 얼음 타일에 걸친다
    straddle.vx = TUNING.runMax
    const before = straddle.vx
    updatePlayer(straddle, input(), grid, DT)
    const iceDrop = before - straddle.vx

    // 비교용: 완전히 일반 땅 위
    const onDirt = createPlayer(2, 9)
    for (let i = 0; i < 40; i++) updatePlayer(onDirt, input(), grid, DT)
    onDirt.x = 8 * TILE
    onDirt.vx = TUNING.runMax
    const b2 = onDirt.vx
    updatePlayer(onDirt, input(), grid, DT)
    const dirtDrop = b2 - onDirt.vx

    expect(iceDrop).toBeLessThan(dirtDrop / 2)
  })
})

describe('가시 적 (밟을 수 없다)', () => {
  const grid: TileGrid = parseTiles(FLAT).grid

  it('걷는다', () => {
    const e = createEnemy('spiky', 8, 9, -1)
    e.active = true
    const x0 = e.x
    const far = createPlayer(28, 9)
    for (let i = 0; i < 30; i++) updateEnemy(e, grid, far, DT)
    expect(e.x).toBeLessThan(x0)
    expect(Math.abs(e.vx)).toBeCloseTo(ENEMY_TUNING.spikySpeed, 0)
  })

  it('위에서 밟아도 성립하지 않는다', () => {
    const p = createPlayer(8, 9)
    const e = createEnemy('spiky', 8, 9, -1)
    p.vy = 100
    p.y = e.y - p.h + 2
    expect(canStomp(p, e)).toBe(false)
  })

  it('밟으려 하면 피격된다', () => {
    const s = newGameState(level(FLAT, {
      entities: [{ type: 'spiky', x: 8, y: 9, dir: -1 }],
    }), 'practice')
    resizePlayer(s.player, 'big')
    const e = s.enemies[0]!
    e.active = true
    s.player.x = e.x
    s.player.y = e.y - s.player.h + 2
    s.player.vy = 100
    const ev = updateFrame(s, input(), DT)
    expect(ev).not.toContain('stomp')
    expect(ev).toContain('hurt')
  })

  it('축구공으로는 없앨 수 있다', () => {
    const s = newGameState(level(FLAT, {
      entities: [{ type: 'spiky', x: 8, y: 9, dir: -1 }],
    }), 'practice')
    const e = s.enemies[0]!
    e.active = true
    s.balls.push({
      x: e.x, y: e.y, vx: 100, vy: 0, w: 12, h: 12,
      onGround: false, bounces: 0, alive: true, hostile: false,
    })
    resolveBalls(s)
    expect(e.alive).toBe(false)
  })
})

describe('던지는 적', () => {
  const grid: TileGrid = parseTiles(FLAT).grid

  it('느리게 걷는다', () => {
    const e = createEnemy('thrower', 10, 9, -1)
    e.active = true
    const far = createPlayer(28, 9)
    for (let i = 0; i < 30; i++) updateEnemy(e, grid, far, DT)
    expect(Math.abs(e.vx)).toBeCloseTo(ENEMY_TUNING.throwerSpeed, 0)
    expect(ENEMY_TUNING.throwerSpeed).toBeLessThan(ENEMY_TUNING.broccoliSpeed)
  })

  it('사거리 안에 플레이어가 있으면 던진다', () => {
    const e = createEnemy('thrower', 10, 9, -1)
    e.active = true
    const near = createPlayer(6, 9)
    let thrown = null
    for (let i = 0; i < 200 && !thrown; i++) thrown = updateEnemy(e, grid, near, DT)
    expect(thrown).not.toBeNull()
    expect(thrown!.hostile).toBe(true)
  })

  it('멀리 있으면 던지지 않는다', () => {
    const e = createEnemy('thrower', 2, 9, -1)
    e.active = true
    const far = createPlayer(28, 9)
    let thrown = null
    for (let i = 0; i < 300 && !thrown; i++) thrown = updateEnemy(e, grid, far, DT)
    expect(thrown).toBeNull()
  })

  it('플레이어가 있는 쪽으로 던진다', () => {
    const e = createEnemy('thrower', 10, 9, -1)
    e.active = true
    const right = createPlayer(15, 9)
    let thrown = null
    for (let i = 0; i < 200 && !thrown; i++) thrown = updateEnemy(e, grid, right, DT)
    expect(thrown!.vx).toBeGreaterThan(0)
  })

  it('밟을 수 없다', () => {
    const p = createPlayer(10, 9)
    const e = createEnemy('thrower', 10, 9, -1)
    p.vy = 100
    p.y = e.y - p.h + 2
    expect(canStomp(p, e)).toBe(false)
  })

  it('hp 2 다 (축구공 두 발)', () => {
    expect(createEnemy('thrower', 5, 9, -1).hp).toBe(2)
  })
})

describe('적 투사체', () => {
  it('플레이어를 때린다', () => {
    const s = newGameState(level(FLAT), 'practice')
    resizePlayer(s.player, 'big')
    const e = createEnemy('thrower', 6, 9, -1)
    const ball = createHostileBall(e)
    ball.x = s.player.x
    ball.y = s.player.y
    s.balls.push(ball)
    const ev = resolveBalls(s)
    expect(ev).toContain('hurt')
    expect(ball.alive).toBe(false)
  })

  it('적을 때리지는 않는다 (아군 사격 없음)', () => {
    const s = newGameState(level(FLAT, {
      entities: [{ type: 'broccoli', x: 8, y: 9, dir: -1 }],
    }), 'practice')
    const target = s.enemies[0]!
    target.active = true
    const e = createEnemy('thrower', 6, 9, -1)
    const ball = createHostileBall(e)
    ball.x = target.x
    ball.y = target.y
    s.balls.push(ball)
    resolveBalls(s)
    expect(target.alive).toBe(true)
  })

  it('적 투사체가 날아다녀도 플레이어 발사가 막히지 않는다', () => {
    const s = newGameState(level(FLAT), 'practice')
    resizePlayer(s.player, 'ball')
    for (let i = 0; i < 30; i++) updateFrame(s, input(), DT)
    // 적 투사체 2발을 띄워둔다
    const e = createEnemy('thrower', 20, 9, -1)
    s.balls.push(createHostileBall(e), createHostileBall(e))
    updateFrame(s, input({ firePressed: true }), DT)
    expect(s.balls.some((b) => !b.hostile)).toBe(true)
  })
})

describe('2월드 구성', () => {
  const w2 = stagesOfWorld(1)

  it('10탄이고 이름이 2-1 ~ 2-10 이다', () => {
    expect(w2).toHaveLength(10)
    expect(w2.map((s) => s.name)).toEqual([
      '2-1', '2-2', '2-3', '2-4', '2-5', '2-6', '2-7', '2-8', '2-9', '2-10',
    ])
  })

  it('2-1 ~ 2-3 은 얼음 테마다', () => {
    for (const s of w2.slice(0, 3)) expect(s.theme).toBe('ice')
  })

  it('얼음 타일이 2월드에만 있다', () => {
    const iceCount = (lv: LevelData) =>
      lv.tiles.reduce((a, r) => a + (r.match(/I/g)?.length ?? 0), 0)
    for (const s of STAGES.slice(0, 10)) {
      expect(iceCount(s), `${s.name} 에 얼음이 있다`).toBe(0)
    }
    expect(w2.reduce((a, s) => a + iceCount(s), 0)).toBeGreaterThan(0)
  })

  it('가시 적은 2-2 부터 나온다', () => {
    const has = (lv: LevelData) => lv.entities.some((e) => e.type === 'spiky')
    for (const s of STAGES.slice(0, 11)) {
      expect(has(s), `${s.name} 에 가시 적이 너무 일찍 나온다`).toBe(false)
    }
    expect(has(w2[1]!)).toBe(true)
  })

  it('던지는 적은 2-3 부터 나온다', () => {
    const has = (lv: LevelData) => lv.entities.some((e) => e.type === 'thrower')
    for (const s of STAGES.slice(0, 12)) {
      expect(has(s), `${s.name} 에 던지는 적이 너무 일찍 나온다`).toBe(false)
    }
    expect(has(w2[2]!)).toBe(true)
  })

  it('2-10 에 보스와 호위가 있다', () => {
    const last = w2[9]!
    expect(last.entities.filter((e) => e.type === 'boss')).toHaveLength(1)
    expect(last.entities.filter((e) => e.type === 'thrower').length).toBeGreaterThan(1)
  })

  it('2-1 은 새 요소를 안전한 평지에서 소개한다 (위험 타일 0)', () => {
    const hazards = w2[0]!.tiles.join('').split('').filter((c) => c === '^' || c === '~').length
    expect(hazards).toBe(0)
  })
})
