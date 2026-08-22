import type { Beam, BulletHue, EBullet, GunSpec, Pattern } from './types'
import { CULL, SKY_H, SKY_W } from './tuning'
import type { Rng } from './rng'

const TAU = Math.PI * 2

/** 패턴별 기본값. GunSpec 에서 생략한 값은 여기서 온다 */
const DEFAULTS: Record<Pattern, Partial<GunSpec>> = {
  aimed: { count: 1, speed: 150, hue: 'pink' },
  spread: { count: 3, speed: 130, arc: 0.7, hue: 'pink' },
  ring: { count: 8, speed: 110, hue: 'blue' },
  spiral: { count: 2, speed: 105, spin: 0.42, hue: 'violet' },
  homing: { count: 1, speed: 95, turn: 2.4, turnMs: 2400, hue: 'lime' },
  wave: { count: 2, speed: 120, amp: 14, hz: 1.4, hue: 'blue' },
  burst: { count: 1, speed: 105, burstAt: 900, burstN: 8, hue: 'amber', big: true },
  rain: { count: 5, speed: 120, hue: 'blue' },
  arc: { count: 5, speed: 125, arc: 1.1, hue: 'amber' },
  laser: { count: 1, hue: 'violet' },
}

export function aimAngle(sx: number, sy: number, px: number, py: number): number {
  return Math.atan2(py - sy, px - sx)
}

function blank(hue: BulletHue): EBullet {
  return {
    x: 0, y: 0, vx: 0, vy: 0, r: 2.6,
    age: 0, life: 9000,
    turn: 0, turnUntil: 0,
    waveAmp: 0, waveHz: 0, baseAngle: 0,
    burstAt: 0, burstN: 0, burstSpeed: 90,
    hue, big: false,
  }
}

function push(
  out: EBullet[],
  x: number, y: number, angle: number, speed: number,
  g: GunSpec, d: Partial<GunSpec>,
): void {
  const b = blank(g.hue ?? d.hue ?? 'pink')
  b.x = x
  b.y = y
  b.baseAngle = angle
  b.vx = Math.cos(angle) * speed
  b.vy = Math.sin(angle) * speed
  b.life = g.life ?? 9000
  b.big = g.big ?? d.big ?? false
  b.r = b.big ? 4.2 : 2.6
  out.push(b)
}

/**
 * 총 하나가 한 번 발사한다.
 *
 * shotIdx 는 이 총이 지금까지 쏜 횟수다. spiral·arc 가 이 값으로
 * 각도를 돌린다 — 시간이 아니라 발사 횟수를 쓰므로 프레임률과 무관하다.
 */
export function fire(
  out: EBullet[],
  beams: Beam[],
  g: GunSpec,
  sx: number,
  sy: number,
  px: number,
  py: number,
  shotIdx: number,
  rng: Rng,
): void {
  const d = DEFAULTS[g.pattern]
  const n = g.count ?? d.count ?? 1
  const speed = g.speed ?? d.speed ?? 120
  const hue = g.hue ?? d.hue ?? 'pink'
  const aim = aimAngle(sx, sy, px, py)

  switch (g.pattern) {
    case 'aimed': {
      // Psikyo 기본기. 여러 발이면 아주 좁게 벌려 다발로 날아간다
      for (let i = 0; i < n; i++) {
        const off = n === 1 ? 0 : (i - (n - 1) / 2) * 0.075
        push(out, sx, sy, aim + off, speed, g, d)
      }
      break
    }

    case 'spread': {
      const arc = g.arc ?? d.arc ?? 0.7
      for (let i = 0; i < n; i++) {
        const t = n === 1 ? 0 : i / (n - 1) - 0.5
        push(out, sx, sy, aim + t * arc, speed, g, d)
      }
      break
    }

    case 'ring': {
      const base = (g.phase ?? 0) + shotIdx * (g.spin ?? 0)
      for (let i = 0; i < n; i++) {
        push(out, sx, sy, base + (i / n) * TAU, speed, g, d)
      }
      break
    }

    case 'spiral': {
      const base = (g.phase ?? 0) + shotIdx * (g.spin ?? d.spin ?? 0.42)
      for (let i = 0; i < n; i++) {
        push(out, sx, sy, base + (i / n) * TAU, speed, g, d)
      }
      break
    }

    case 'homing': {
      for (let i = 0; i < n; i++) {
        // 처음에는 옆으로 흩어져 나갔다가 꺾어 들어온다. 정면으로만
        // 나가면 유도인지 알아볼 수가 없다
        const off = n === 1 ? 0 : (i - (n - 1) / 2) * 0.6
        const b = blank(hue)
        b.x = sx
        b.y = sy
        const a = aim + off
        b.baseAngle = a
        b.vx = Math.cos(a) * speed
        b.vy = Math.sin(a) * speed
        b.turn = g.turn ?? d.turn ?? 2.4
        b.turnUntil = g.turnMs ?? d.turnMs ?? 2400
        b.life = g.life ?? 5200
        b.big = g.big ?? false
        b.r = b.big ? 4 : 3
        out.push(b)
      }
      break
    }

    case 'wave': {
      const amp = g.amp ?? d.amp ?? 14
      const hz = g.hz ?? d.hz ?? 1.4
      for (let i = 0; i < n; i++) {
        const b = blank(hue)
        b.x = sx
        b.y = sy
        b.baseAngle = aim
        b.vx = Math.cos(aim) * speed
        b.vy = Math.sin(aim) * speed
        b.waveAmp = amp
        b.waveHz = hz
        // 갈래마다 위상을 어긋내 꼬아 놓는다
        b.age = (i / n) * (1000 / hz)
        b.life = (g.life ?? 6000) + b.age
        out.push(b)
      }
      break
    }

    case 'burst': {
      for (let i = 0; i < n; i++) {
        const off = n === 1 ? 0 : (i - (n - 1) / 2) * 0.35
        const b = blank(hue)
        b.x = sx
        b.y = sy
        const a = aim + off
        b.baseAngle = a
        b.vx = Math.cos(a) * speed
        b.vy = Math.sin(a) * speed
        b.burstAt = g.burstAt ?? d.burstAt ?? 900
        b.burstN = g.burstN ?? d.burstN ?? 8
        b.burstSpeed = (g.speed ?? 105) * 0.85
        b.big = true
        b.r = 4.2
        b.life = g.life ?? 9000
        out.push(b)
      }
      break
    }

    case 'rain': {
      // 화면 위에서 쏟아진다. 플레이어 주변을 넓게 덮어 자리를 뺏는다
      for (let i = 0; i < n; i++) {
        const x = Math.max(4, Math.min(SKY_W - 4, px + rng.range(-110, 110)))
        const a = Math.PI / 2 + rng.range(-0.22, 0.22)
        push(out, x, -6 - rng.range(0, 30), a, speed, g, d)
      }
      break
    }

    case 'arc': {
      // 부채꼴 전체가 발사마다 좌우로 쓸린다
      const arc = g.arc ?? d.arc ?? 1.1
      const steps = 6
      const tri = Math.abs(((shotIdx % (steps * 2)) - steps) / steps) * 2 - 1
      const centre = aim + tri * arc * 0.5
      for (let i = 0; i < n; i++) {
        const t = n === 1 ? 0 : i / (n - 1) - 0.5
        push(out, sx, sy, centre + t * arc, speed, g, d)
      }
      break
    }

    case 'laser': {
      beams.push({
        x: sx,
        y: sy,
        angle: aim,
        half: g.big ? 7 : 4,
        age: 0,
        warnMs: g.warnMs ?? 700,
        fireMs: g.life ?? 900,
        hue,
      })
      break
    }
  }
}

/** 사인파가 얹힌 탄의 실제 위치. 판정과 그리기가 같은 값을 써야 한다 */
export function bulletX(b: EBullet): number {
  if (b.waveAmp === 0) return b.x
  return b.x - Math.sin(b.baseAngle) * b.waveAmp * Math.sin(TAU * b.waveHz * b.age / 1000)
}

export function bulletY(b: EBullet): number {
  if (b.waveAmp === 0) return b.y
  return b.y + Math.cos(b.baseAngle) * b.waveAmp * Math.sin(TAU * b.waveHz * b.age / 1000)
}

function offscreen(x: number, y: number): boolean {
  return x < -CULL || x > SKY_W + CULL || y < -CULL || y > SKY_H + CULL
}

/**
 * 탄을 한 프레임 움직인다. 분열탄은 여기서 터진다.
 * 살아남은 탄만 남기고 배열을 새로 돌려준다.
 */
export function stepBullets(
  bullets: EBullet[],
  px: number,
  py: number,
  dt: number,
): EBullet[] {
  const ms = dt * 1000
  const out: EBullet[] = []

  for (const b of bullets) {
    b.age += ms

    // 유도 — 정해진 시간까지만 꺾는다. 끝없이 쫓아오면 피할 수가 없다
    if (b.turn > 0 && b.age < b.turnUntil) {
      const cur = Math.atan2(b.vy, b.vx)
      const want = Math.atan2(py - b.y, px - b.x)
      let diff = want - cur
      while (diff > Math.PI) diff -= TAU
      while (diff < -Math.PI) diff += TAU
      const max = b.turn * dt
      const a = cur + Math.max(-max, Math.min(max, diff))
      const sp = Math.hypot(b.vx, b.vy)
      b.vx = Math.cos(a) * sp
      b.vy = Math.sin(a) * sp
      b.baseAngle = a
    }

    b.x += b.vx * dt
    b.y += b.vy * dt

    if (b.burstAt > 0 && b.age >= b.burstAt) {
      const base = Math.atan2(b.vy, b.vx)
      for (let i = 0; i < b.burstN; i++) {
        const c = blank(b.hue)
        c.x = b.x
        c.y = b.y
        const a = base + (i / b.burstN) * TAU
        c.baseAngle = a
        c.vx = Math.cos(a) * b.burstSpeed
        c.vy = Math.sin(a) * b.burstSpeed
        c.life = 6000
        out.push(c)
      }
      continue // 원래 탄은 사라진다
    }

    if (b.age >= b.life) continue
    if (offscreen(bulletX(b), bulletY(b))) continue
    out.push(b)
  }

  return out
}

/** 빔을 한 프레임 진행시킨다 */
export function stepBeams(beams: Beam[], dt: number): Beam[] {
  const ms = dt * 1000
  const out: Beam[] = []
  for (const s of beams) {
    s.age += ms
    if (s.age < s.warnMs + s.fireMs) out.push(s)
  }
  return out
}

/** 빔이 지금 피해를 주는 상태인가 */
export function beamLive(s: Beam): boolean {
  return s.age >= s.warnMs
}

/** 점이 빔에 닿았는가. 빔은 시작점에서 앞쪽으로만 뻗는다 */
export function beamHits(s: Beam, px: number, py: number, r: number): boolean {
  if (!beamLive(s)) return false
  const dx = px - s.x
  const dy = py - s.y
  const along = dx * Math.cos(s.angle) + dy * Math.sin(s.angle)
  if (along < 0) return false
  const perp = Math.abs(-dx * Math.sin(s.angle) + dy * Math.cos(s.angle))
  return perp <= s.half + r
}

/** 빔이 화면을 가로지르는 길이. 그릴 때 쓴다 */
export function beamLength(): number {
  return Math.hypot(SKY_W, SKY_H) + CULL
}
