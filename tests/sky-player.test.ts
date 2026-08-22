import { beforeEach, describe, expect, it } from 'vitest'
import type { Option, Shot, SkyPlayer } from '../src/sky/types'
import {
  NO_INPUT, addBomb, autoFire, bump, moveOptions, movePlayer, newPlayer,
  powerUp, syncOptions, useBomb, type SkyInput,
} from '../src/sky/player'
import { BOUND, MISSILE_EVERY, PLAYER, SHOT_LEVELS } from '../src/sky/tuning'

const DT = 1 / 60
const drag = (tx: number, ty: number): SkyInput => ({ tx, ty, ax: 0, ay: 0, bomb: false })
const keys = (ax: number, ay: number): SkyInput => ({ tx: null, ty: null, ax, ay, bomb: false })

let p: SkyPlayer
beforeEach(() => {
  p = newPlayer()
})

describe('이동', () => {
  it('드래그 목표를 향해 간다', () => {
    const x0 = p.x
    movePlayer(p, drag(300, 40), DT)
    expect(p.x).toBeGreaterThan(x0)
    expect(p.y).toBeLessThan(newPlayer().y)
  })

  it('여러 프레임이면 목표에 거의 닿는다', () => {
    for (let i = 0; i < 30; i++) movePlayer(p, drag(300, 40), DT)
    expect(p.x).toBeCloseTo(300, 0)
    expect(p.y).toBeCloseTo(40, 0)
  })

  it('화면 밖으로는 못 나간다', () => {
    for (let i = 0; i < 200; i++) movePlayer(p, drag(-999, -999), DT)
    expect(p.x).toBe(BOUND.x0)
    expect(p.y).toBe(BOUND.y0)
    for (let i = 0; i < 200; i++) movePlayer(p, drag(999, 999), DT)
    expect(p.x).toBe(BOUND.x1)
    expect(p.y).toBe(BOUND.y1)
  })

  it('키보드로도 움직인다', () => {
    const x0 = p.x
    for (let i = 0; i < 60; i++) movePlayer(p, keys(1, 0), DT)
    expect(p.x - x0).toBeCloseTo(PLAYER.keySpeed, 0)
  })

  it('경직 중에는 느려진다', () => {
    const a = newPlayer()
    const b = newPlayer()
    b.stunMs = 400
    for (let i = 0; i < 10; i++) {
      movePlayer(a, keys(1, 0), DT)
      movePlayer(b, keys(1, 0), DT)
    }
    expect(b.x - newPlayer().x).toBeLessThan(a.x - newPlayer().x)
  })

  it('무적 시간이 흐른다', () => {
    const before = p.invMs
    movePlayer(p, NO_INPUT, DT)
    expect(p.invMs).toBeLessThan(before)
  })
})

describe('파워와 옵션 (텐가이 사역마)', () => {
  it('4단계에서 멈춘다', () => {
    expect(powerUp(p)).toBe(true)
    expect(powerUp(p)).toBe(true)
    expect(powerUp(p)).toBe(true)
    expect(powerUp(p)).toBe(false)
    expect(p.power).toBe(PLAYER.maxPower)
  })

  it('파워가 오르면 옵션이 늘어난다', () => {
    let opts: Option[] = []
    for (let lv = 0; lv <= 3; lv++) {
      p.power = lv
      opts = syncOptions(p, opts)
      expect(opts.length, `파워 ${lv}`).toBe(SHOT_LEVELS[lv]!.options)
    }
  })

  it('옵션이 본체를 따라온다', () => {
    p.power = 2
    const opts = syncOptions(p, [])
    p.x = 200
    p.y = 100
    for (let i = 0; i < 60; i++) moveOptions(p, opts, DT)
    for (const o of opts) {
      expect(Math.abs(o.x - (p.x - 10))).toBeLessThan(2)
      expect(Math.abs(o.y - (p.y + o.oy))).toBeLessThan(2)
    }
  })
})

describe('자동 발사', () => {
  function volley(power: number, frames: number): Shot[] {
    p.power = power
    const opts = syncOptions(p, [])
    const shots: Shot[] = []
    for (let i = 0; i < frames; i++) autoFire(p, opts, shots, DT)
    return shots
  }

  it('파워 1단계는 한 갈래', () => {
    const shots = volley(0, 1)
    expect(shots).toHaveLength(1)
    expect(shots[0]!.homing).toBe(false)
  })

  it('간격을 지킨다 — 매 프레임 쏘지 않는다', () => {
    p.power = 0
    const shots: Shot[] = []
    for (let i = 0; i < 6; i++) autoFire(p, [], shots, DT)
    expect(shots).toHaveLength(1)
  })

  it('파워가 오르면 갈래가 늘어난다', () => {
    expect(volley(2, 1).filter((s) => !s.homing)).toHaveLength(3)
  })

  it('유도 미사일은 최대 파워에서만 나온다', () => {
    expect(volley(2, 240).some((s) => s.homing)).toBe(false)
    expect(volley(3, 240).some((s) => s.homing)).toBe(true)
  })

  it(`미사일은 ${MISSILE_EVERY}발에 한 번만 — 매번 내면 화면이 덮인다`, () => {
    const shots = volley(3, 240)
    const main = shots.filter((s) => !s.homing && s.r > 2.6).length
    const missiles = shots.filter((s) => s.homing).length
    // 본탄 3갈래 × N번 발사, 미사일은 N/4 번
    expect(missiles).toBeGreaterThan(0)
    expect(missiles).toBeLessThanOrEqual(Math.ceil(main / 3 / MISSILE_EVERY) + 1)
  })

  it('옵션도 따로 쏜다', () => {
    p.power = 2
    const opts = syncOptions(p, [])
    const shots: Shot[] = []
    for (let i = 0; i < 60; i++) autoFire(p, opts, shots, DT)
    // 옵션 탄은 본탄보다 약하다
    expect(shots.some((s) => s.dmg < SHOT_LEVELS[2]!.dmg)).toBe(true)
  })
})

describe('적과 부딪힘 (텐가이 규칙 — 죽지 않는다)', () => {
  it('파워를 한 단계만 잃고 경직된다', () => {
    p.power = 2
    p.invMs = 0
    bump(p)
    expect(p.power).toBe(1)
    expect(p.stunMs).toBe(PLAYER.stunMs)
    expect(p.alive).toBe(true)
  })

  it('파워 0이면 더 내려가지 않는다', () => {
    p.invMs = 0
    bump(p)
    expect(p.power).toBe(0)
  })

  it('무적 중에는 아무 일도 없다', () => {
    p.power = 2
    p.invMs = 500
    bump(p)
    expect(p.power).toBe(2)
  })

  it('경직 중에 또 부딪혀도 두 번 깎이지 않는다', () => {
    p.power = 3
    p.invMs = 0
    bump(p)
    bump(p)
    expect(p.power).toBe(2)
  })
})

describe('궁극기', () => {
  it('쓰면 하나 줄고 무적이 붙는다', () => {
    p.invMs = 0
    expect(useBomb(p)).toBe(true)
    expect(p.bombs).toBe(PLAYER.startBombs - 1)
    expect(p.invMs).toBe(PLAYER.bombInvMs)
  })

  it('없으면 못 쓴다', () => {
    p.bombs = 0
    expect(useBomb(p)).toBe(false)
  })

  it('죽어 있으면 못 쓴다', () => {
    p.alive = false
    expect(useBomb(p)).toBe(false)
  })

  it(`최대 ${PLAYER.maxBombs}개까지만 쌓인다`, () => {
    p.bombs = PLAYER.maxBombs
    expect(addBomb(p)).toBe(false)
    p.bombs = PLAYER.maxBombs - 1
    expect(addBomb(p)).toBe(true)
    expect(p.bombs).toBe(PLAYER.maxBombs)
  })
})
