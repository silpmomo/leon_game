import { describe, expect, it } from 'vitest'
import type { Beam, EBullet, GunSpec } from '../src/sky/types'
import {
  aimAngle, beamHits, beamLive, bulletX, bulletY, fire, stepBeams, stepBullets,
} from '../src/sky/bullets'
import { SKY_H, SKY_W } from '../src/sky/tuning'
import { makeRng } from '../src/sky/rng'

const DT = 1 / 60
const rng = () => makeRng(12345)

function shoot(g: GunSpec, sx = 300, sy = 90, px = 60, py = 90, idx = 0) {
  const out: EBullet[] = []
  const beams: Beam[] = []
  fire(out, beams, g, sx, sy, px, py, idx, rng())
  return { out, beams }
}

const angleOf = (b: EBullet) => Math.atan2(b.vy, b.vx)

/** 각도 차를 -π..π 로 접는다. atan2 가 +π 와 -π 를 오가면 2π 차이로 보인다 */
function angleGap(a: number, b: number): number {
  let d = a - b
  while (d > Math.PI) d -= Math.PI * 2
  while (d < -Math.PI) d += Math.PI * 2
  return d
}

describe('조준탄 (Psikyo 기본기)', () => {
  it('플레이어를 향해 날아간다', () => {
    const { out } = shoot({ pattern: 'aimed', everyMs: 1000, speed: 100 }, 300, 40, 60, 150)
    expect(out).toHaveLength(1)
    const want = aimAngle(300, 40, 60, 150)
    expect(angleOf(out[0]!)).toBeCloseTo(want, 5)
  })

  it('여러 발이면 아주 좁게 벌어진다', () => {
    const { out } = shoot({ pattern: 'aimed', everyMs: 1000, count: 3, speed: 100 })
    expect(out).toHaveLength(3)
    const spread = Math.abs(angleGap(angleOf(out[2]!), angleOf(out[0]!)))
    expect(spread).toBeGreaterThan(0)
    expect(spread).toBeLessThan(0.3)
  })

  it('탄속이 지정한 값이다', () => {
    const { out } = shoot({ pattern: 'aimed', everyMs: 1000, speed: 137 })
    expect(Math.hypot(out[0]!.vx, out[0]!.vy)).toBeCloseTo(137, 4)
  })
})

describe('부채꼴 · 전방위 · 나선', () => {
  it('spread 는 지정한 각도만큼 벌어진다', () => {
    const { out } = shoot({ pattern: 'spread', everyMs: 1000, count: 5, arc: 1.2, speed: 90 })
    expect(out).toHaveLength(5)
    expect(Math.abs(angleGap(angleOf(out[4]!), angleOf(out[0]!)))).toBeCloseTo(1.2, 3)
  })

  it('ring 은 360도를 고르게 나눈다', () => {
    const { out } = shoot({ pattern: 'ring', everyMs: 1000, count: 8, speed: 90 })
    expect(out).toHaveLength(8)
    const gaps = out.map((b, i) => angleOf(b) - angleOf(out[i === 0 ? out.length - 1 : i - 1]!))
    const norm = gaps.map((g) => ((g % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2))
    for (const g of norm) expect(g).toBeCloseTo(Math.PI / 4, 3)
  })

  it('spiral 은 발사할 때마다 각도가 돌아간다', () => {
    const g: GunSpec = { pattern: 'spiral', everyMs: 100, count: 1, spin: 0.4, speed: 90 }
    const a0 = angleOf(shoot(g, 300, 90, 60, 90, 0).out[0]!)
    const a1 = angleOf(shoot(g, 300, 90, 60, 90, 1).out[0]!)
    let d = a1 - a0
    while (d > Math.PI) d -= Math.PI * 2
    while (d < -Math.PI) d += Math.PI * 2
    expect(d).toBeCloseTo(0.4, 4)
  })

  it('arc 는 발사마다 부채꼴이 좌우로 쓸린다', () => {
    const g: GunSpec = { pattern: 'arc', everyMs: 100, count: 3, arc: 1.0, speed: 90 }
    const centres = [0, 3, 6, 9].map((i) => {
      const o = shoot(g, 300, 90, 60, 90, i).out
      return angleOf(o[1]!)
    })
    // 전부 같으면 쓸리지 않는 것이다
    expect(new Set(centres.map((c) => c.toFixed(3))).size).toBeGreaterThan(1)
  })
})

describe('유도탄', () => {
  const homingGun: GunSpec = {
    pattern: 'homing', everyMs: 1000, count: 1, speed: 100, turn: 3, turnMs: 2000,
  }

  it('처음에는 플레이어 쪽을 향하고 유도값을 갖는다', () => {
    const { out } = shoot(homingGun)
    expect(out[0]!.turn).toBe(3)
    expect(out[0]!.turnUntil).toBe(2000)
  })

  it('플레이어 쪽으로 꺾인다', () => {
    const { out } = shoot(homingGun, 300, 30, 60, 30)
    const b = out[0]!
    // 발사 뒤 플레이어가 아래로 크게 이동했다고 치자
    const before = Math.abs(angleOf(b) - Math.atan2(150 - b.y, 60 - b.x))
    const after = stepBullets([b], 60, 150, DT * 20)
    const now = after[0]!
    const diff = Math.abs(angleOf(now) - Math.atan2(150 - now.y, 60 - now.x))
    expect(diff).toBeLessThan(before)
  })

  it('한 프레임에 turn 라디안을 넘게 꺾지 않는다', () => {
    const { out } = shoot(homingGun, 300, 30, 60, 30)
    const b = out[0]!
    const a0 = angleOf(b)
    stepBullets([b], 60, 180, DT)
    const d = Math.abs(angleOf(b) - a0)
    expect(d).toBeLessThanOrEqual(3 * DT + 1e-9)
  })

  it('turnMs 가 지나면 유도를 멈춘다 — 안 그러면 영원히 못 피한다', () => {
    const { out } = shoot({ ...homingGun, turnMs: 100, life: 9000 }, 300, 30, 60, 30)
    const b = out[0]!
    b.age = 200
    const a0 = angleOf(b)
    stepBullets([b], 60, 180, DT)
    expect(angleOf(b)).toBeCloseTo(a0, 9)
  })
})

describe('사인파 탄', () => {
  it('진행 방향과 수직으로 흔들린다', () => {
    const { out } = shoot(
      { pattern: 'wave', everyMs: 1000, count: 1, speed: 100, amp: 20, hz: 1 },
      300, 90, 60, 90,
    )
    const b = out[0]!
    b.age = 250 // 1Hz 의 1/4 주기 → 최대 진폭
    expect(Math.abs(bulletY(b) - b.y)).toBeGreaterThan(15)
    expect(bulletX(b)).toBeCloseTo(b.x, 6)
  })

  it('진폭이 0이면 위치가 그대로다', () => {
    const { out } = shoot({ pattern: 'aimed', everyMs: 1000, speed: 100 })
    const b = out[0]!
    expect(bulletX(b)).toBe(b.x)
    expect(bulletY(b)).toBe(b.y)
  })
})

describe('분열탄', () => {
  it('정해진 시각에 링으로 터지고 원래 탄은 사라진다', () => {
    const { out } = shoot(
      { pattern: 'burst', everyMs: 1000, speed: 100, burstAt: 100, burstN: 6 },
      300, 90, 60, 90,
    )
    const b = out[0]!
    b.age = 99
    const after = stepBullets([b], 60, 90, DT)
    expect(after).toHaveLength(6)
    expect(after.every((x) => x.burstAt === 0)).toBe(true)
  })
})

describe('비 (광역 차단)', () => {
  it('화면 위에서 플레이어 근처로 쏟아진다', () => {
    const { out } = shoot(
      { pattern: 'rain', everyMs: 1000, count: 8, speed: 100 }, 300, 20, 200, 100,
    )
    expect(out).toHaveLength(8)
    for (const b of out) {
      expect(b.y).toBeLessThan(0)
      expect(b.vy).toBeGreaterThan(0)
      expect(b.x).toBeGreaterThanOrEqual(0)
      expect(b.x).toBeLessThanOrEqual(SKY_W)
    }
  })
})

describe('빔', () => {
  const beam = (): Beam => ({
    x: 300, y: 90, angle: Math.PI, half: 4, age: 0, warnMs: 500, fireMs: 400, hue: 'violet',
  })

  it('예고 중에는 맞지 않는다', () => {
    const s = beam()
    expect(beamLive(s)).toBe(false)
    expect(beamHits(s, 100, 90, 2)).toBe(false)
  })

  it('발사 중에는 선 위의 점에 맞는다', () => {
    const s = beam()
    s.age = 600
    expect(beamLive(s)).toBe(true)
    expect(beamHits(s, 100, 90, 2)).toBe(true)
    expect(beamHits(s, 100, 130, 2)).toBe(false)
  })

  it('뒤쪽으로는 뻗지 않는다', () => {
    const s = beam()
    s.age = 600
    expect(beamHits(s, 380, 90, 2)).toBe(false)
  })

  it('수명이 다하면 사라진다', () => {
    const s = beam()
    s.age = 860 // 총 수명 900ms. 한 프레임(16.7ms) 더 가도 남아 있어야 한다
    expect(stepBeams([s], DT)).toHaveLength(1)
    s.age = 895
    expect(stepBeams([s], DT)).toHaveLength(0)
  })
})

describe('탄 정리', () => {
  it('화면 밖으로 나가면 사라진다', () => {
    const { out } = shoot({ pattern: 'aimed', everyMs: 1000, speed: 100 }, 10, 90, -400, 90)
    const b = out[0]!
    b.x = -80
    expect(stepBullets([b], 60, 90, DT)).toHaveLength(0)
  })

  it('수명이 다하면 사라진다', () => {
    const { out } = shoot({ pattern: 'aimed', everyMs: 1000, speed: 10, life: 100 })
    const b = out[0]!
    b.age = 99
    expect(stepBullets([b], 60, 90, DT)).toHaveLength(0)
  })

  it('화면 안에 있으면 남는다', () => {
    const { out } = shoot({ pattern: 'aimed', everyMs: 1000, speed: 10 }, SKY_W / 2, SKY_H / 2)
    expect(stepBullets(out, 60, 90, DT)).toHaveLength(1)
  })
})
