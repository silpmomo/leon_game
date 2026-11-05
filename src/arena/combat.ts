import type {
  ArenaEvent, ArenaState, Fighter, Skin, WeaponId,
} from './types'
import {
  blocksShot, clearShot, damageCrate, inBush, moveBox, tileAt,
} from './grid'
import {
  BASE_HP, BUSH_SEE_PX, FIGHTER_R, GAS_DELAY_S, GAS_DPS, GAS_MIN_FRAC, GAS_SHRINK_S,
  BOT_DMG_TO_PLAYER, GEM_DMG, GEM_HP, GEM_PICK_R, HEAL_DELAY_MS, HEAL_RATE,
    REVEAL_MS, SCORE, SPEED, SUPER_COST, TILE, WEAPONS, WORLD_H, WORLD_W,
} from './tuning'

/**
 * 전투 규칙 — 이동 · 사격 · 탄 · 피해 · 별 · 회복 · 독안개.
 * 플레이어와 봇이 같은 함수를 쓴다. 다른 건 입력이 어디서 오느냐뿐이다.
 */

export const MAX_AMMO = 3

export function makeFighter(
  id: number, name: string, skin: Skin, weapon: WeaponId,
  isPlayer: boolean, x: number, y: number,
): Fighter {
  return {
    id, name, skin, weapon, isPlayer, x, y,
    faceX: 1, faceY: 0,
    hp: BASE_HP, maxHp: BASE_HP, gems: 0,
    ammo: MAX_AMMO, cooldownMs: 0, superCharge: 0,
    calmMs: HEAL_DELAY_MS, revealMs: 0, hurtMs: 0,
    alive: true, kills: 0, rank: 0, brain: null,
  }
}

export function dmgMul(f: Fighter): number {
  return 1 + f.gems * GEM_DMG
}

// ── 독안개 ────────────────────────────────────────────────────

export type SafeRect = { x0: number; y0: number; x1: number; y1: number }

/** 0 = 아직 안 조임, 1 = 다 조임 */
export function gasProgress(t: number): number {
  return Math.max(0, Math.min(1, (t - GAS_DELAY_S) / GAS_SHRINK_S))
}

export function safeRect(t: number): SafeRect {
  const inset = gasProgress(t) * (1 - GAS_MIN_FRAC) / 2
  return {
    x0: WORLD_W * inset,
    y0: WORLD_H * inset,
    x1: WORLD_W * (1 - inset),
    y1: WORLD_H * (1 - inset),
  }
}

export function inGas(t: number, x: number, y: number): boolean {
  const r = safeRect(t)
  return x < r.x0 || x > r.x1 || y < r.y0 || y > r.y1
}

// ── 시야 ──────────────────────────────────────────────────────

/** viewer 가 target 을 볼 수 있는가. 수풀 속이면 가까이 와야 보인다 */
export function canSee(s: ArenaState, viewer: Fighter, target: Fighter): boolean {
  if (!target.alive) return false
  if (target.revealMs > 0) return true
  if (!inBush(s.grid, target.x, target.y)) return true
  return Math.hypot(target.x - viewer.x, target.y - viewer.y) <= BUSH_SEE_PX
}

// ── 이동 ──────────────────────────────────────────────────────

export function moveFighter(s: ArenaState, f: Fighter, mx: number, my: number, dt: number): void {
  const len = Math.hypot(mx, my)
  if (len < 0.05) return
  const k = len > 1 ? 1 / len : 1
  const vx = mx * k
  const vy = my * k
  ;[f.x, f.y] = moveBox(s.grid, f.x, f.y, vx * SPEED * dt, vy * SPEED * dt)
  f.faceX = vx / Math.hypot(vx, vy)
  f.faceY = vy / Math.hypot(vx, vy)
}

// ── 조준 ──────────────────────────────────────────────────────

export type Aim = { dx: number; dy: number; target: 'fighter' | 'crate' | 'none' }

/**
 * 자동 조준. 아이가 조준까지 하기는 어렵다.
 * 보이는 가장 가까운 상대 → 가장 가까운 상자 → 바라보는 방향.
 */
export function autoAim(s: ArenaState, f: Fighter): Aim {
  const w = WEAPONS[f.weapon]
  const reach = w.range * 1.15
  let best: Fighter | null = null
  let bestD = Infinity
  for (const o of s.fighters) {
    if (o === f || !o.alive || !canSee(s, f, o)) continue
    const d = Math.hypot(o.x - f.x, o.y - f.y)
    if (d > reach || d >= bestD) continue
    if (!clearShot(s.grid, f.x, f.y, o.x, o.y)) continue
    best = o
    bestD = d
  }
  if (best) return { dx: best.x - f.x, dy: best.y - f.y, target: 'fighter' }

  const crate = nearestCrate(s, f.x, f.y, w.range)
  if (crate) return { dx: crate[0] - f.x, dy: crate[1] - f.y, target: 'crate' }
  return { dx: f.faceX, dy: f.faceY, target: 'none' }
}

/** 사거리 안에서 막힘 없이 쏠 수 있는 가장 가까운 상자 중심 */
export function nearestCrate(
  s: ArenaState, x: number, y: number, range: number,
): [number, number] | null {
  const g = s.grid
  const r = Math.ceil(range / TILE)
  const cx = Math.floor(x / TILE)
  const cy = Math.floor(y / TILE)
  let best: [number, number] | null = null
  let bestD = Infinity
  for (let ty = cy - r; ty <= cy + r; ty++) {
    for (let tx = cx - r; tx <= cx + r; tx++) {
      if (tileAt(g, tx, ty) !== 'x') continue
      const px = (tx + 0.5) * TILE
      const py = (ty + 0.5) * TILE
      const d = Math.hypot(px - x, py - y)
      if (d > range || d >= bestD) continue
      // 상자 바로 앞 칸까지 막힘이 없으면 맞는다
      const k = Math.max(0, (d - TILE * 0.7) / d)
      if (!clearShot(g, x, y, x + (px - x) * k, y + (py - y) * k)) continue
      best = [px, py]
      bestD = d
    }
  }
  return best
}

// ── 사격 ──────────────────────────────────────────────────────

export function canFire(f: Fighter): boolean {
  return f.alive && f.ammo >= 1 && f.cooldownMs <= 0
}

export function fire(
  s: ArenaState, f: Fighter, dx: number, dy: number, events: ArenaEvent[],
): boolean {
  if (!canFire(f)) return false
  const w = WEAPONS[f.weapon]
  const base = Math.atan2(dy, dx)
  const mul = dmgMul(f)
  for (let i = 0; i < w.pellets; i++) {
    const a = w.pellets === 1 ? base : base + w.spread * (i / (w.pellets - 1) - 0.5)
    spawnBullet(s, f, a, w.speed, w.range, w.dmg * mul, w.color, false)
  }
  f.ammo -= 1
  f.cooldownMs = w.cooldownMs
  f.calmMs = 0
  f.revealMs = REVEAL_MS
  f.faceX = Math.cos(base)
  f.faceY = Math.sin(base)
  if (f.isPlayer) events.push('shot')
  return true
}

/** 필살기: 사방으로 굵은 번개 */
export function fireSuper(s: ArenaState, f: Fighter, events: ArenaEvent[]): boolean {
  if (!f.alive || f.superCharge < 1) return false
  const w = WEAPONS[f.weapon]
  const mul = dmgMul(f)
  for (let i = 0; i < w.ringCount; i++) {
    const a = (i / w.ringCount) * Math.PI * 2
    spawnBullet(s, f, a, w.speed * 0.9, w.ringRange, w.ringDmg * mul, w.color, true)
  }
  f.superCharge = 0
  f.calmMs = 0
  f.revealMs = REVEAL_MS
  s.bursts.push({ x: f.x, y: f.y, ms: 400, color: w.color })
  if (f.isPlayer) events.push('super')
  return true
}

function spawnBullet(
  s: ArenaState, f: Fighter, a: number, speed: number, range: number,
  dmg: number, color: string, big: boolean,
): void {
  const vx = Math.cos(a)
  const vy = Math.sin(a)
  s.bullets.push({
    owner: f.id,
    x: f.x + vx * FIGHTER_R,
    y: f.y + vy * FIGHTER_R,
    vx: vx * speed,
    vy: vy * speed,
    left: range,
    dmg,
    color,
    big,
  })
}

// ── 피해 ──────────────────────────────────────────────────────

/** from: 때린 파이터 id. -1 은 독안개 */
export function hurt(
  s: ArenaState, target: Fighter, amount: number, from: number, events: ArenaEvent[],
  charge = true,
): void {
  if (!target.alive) return
  const attacker = from >= 0 ? s.fighters[from] : undefined
  let dmg = amount
  if (attacker && !attacker.isPlayer && target.isPlayer) dmg *= BOT_DMG_TO_PLAYER[s.mode]
  target.hp -= dmg
  target.calmMs = 0
  target.hurtMs = 160
  if (attacker && charge) {
    attacker.superCharge = Math.min(1, attacker.superCharge + dmg / SUPER_COST)
  }
  if (target.isPlayer && from >= 0) events.push('playerHurt')
  else if (attacker?.isPlayer) events.push('hit')

  if (target.hp > 0) return
  target.hp = 0
  target.alive = false
  target.rank = s.nextRank
  s.nextRank -= 1
  s.bursts.push({ x: target.x, y: target.y, ms: 500, color: '#ffffff' })
  dropGems(s, target)
  if (attacker) {
    attacker.kills += 1
    if (attacker.isPlayer) {
      s.score += SCORE.kill
      events.push('kill')
    }
  }
  if (target.isPlayer) events.push('die')
}

/** 가진 별을 둘레에 흩뿌린다. 하나도 없었어도 1개는 떨군다 */
function dropGems(s: ArenaState, f: Fighter): void {
  const n = Math.max(1, f.gems)
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2 + 0.4
    const r = n === 1 ? 0 : 7
    let gx = f.x + Math.cos(a) * r
    let gy = f.y + Math.sin(a) * r
    // 벽 안에 떨어지면 주운 사람이 없다 — 그 자리로 되돌린다
    if (blocksShot(tileAt(s.grid, Math.floor(gx / TILE), Math.floor(gy / TILE)))) {
      gx = f.x
      gy = f.y
    }
    s.gems.push({ x: gx, y: gy, bobMs: i * 120 })
  }
}

// ── 탄 ────────────────────────────────────────────────────────

const HIT_R = FIGHTER_R + 2

export function updateBullets(s: ArenaState, dt: number, events: ArenaEvent[]): void {
  const keep = []
  for (const b of s.bullets) {
    const step = Math.hypot(b.vx, b.vy) * dt
    b.x += b.vx * dt
    b.y += b.vy * dt
    b.left -= step
    if (b.left <= 0) continue

    const tx = Math.floor(b.x / TILE)
    const ty = Math.floor(b.y / TILE)
    const t = tileAt(s.grid, tx, ty)
    if (blocksShot(t)) {
      if (t === 'x') {
        const owner = s.fighters[b.owner]
        if (damageCrate(s.grid, tx, ty, b.big ? 999 : b.dmg)) {
          s.gems.push({ x: (tx + 0.5) * TILE, y: (ty + 0.5) * TILE, bobMs: 0 })
          s.bursts.push({ x: (tx + 0.5) * TILE, y: (ty + 0.5) * TILE, ms: 350, color: '#c98a4a' })
          if (owner?.isPlayer) events.push('crate')
        } else if (owner?.isPlayer) {
          events.push('hit')
        }
      }
      continue
    }

    let hit = false
    for (const f of s.fighters) {
      if (!f.alive || f.id === b.owner) continue
      if (Math.abs(f.x - b.x) > HIT_R || Math.abs(f.y - b.y) > HIT_R) continue
      if ((f.x - b.x) ** 2 + (f.y - b.y) ** 2 > HIT_R * HIT_R) continue
      hurt(s, f, b.dmg, b.owner, events, !b.big)
      hit = true
      break
    }
    if (!hit) keep.push(b)
  }
  s.bullets = keep
}

// ── 시간에 따른 것들 ──────────────────────────────────────────

export function tickFighter(s: ArenaState, f: Fighter, dt: number, events: ArenaEvent[]): void {
  if (!f.alive) return
  const ms = dt * 1000
  const w = WEAPONS[f.weapon]
  f.cooldownMs = Math.max(0, f.cooldownMs - ms)
  f.revealMs = Math.max(0, f.revealMs - ms)
  f.hurtMs = Math.max(0, f.hurtMs - ms)
  if (f.ammo < MAX_AMMO) f.ammo = Math.min(MAX_AMMO, f.ammo + ms / w.reloadMs)

  if (inGas(s.t, f.x, f.y)) {
    hurt(s, f, GAS_DPS * dt, -1, events, false)
    return
  }

  f.calmMs += ms
  if (f.calmMs >= HEAL_DELAY_MS && f.hp < f.maxHp) {
    f.hp = Math.min(f.maxHp, f.hp + f.maxHp * HEAL_RATE * dt)
  }
}

export function pickGems(s: ArenaState, events: ArenaEvent[]): void {
  if (s.gems.length === 0) return
  const keep = []
  for (const g of s.gems) {
    let taker: Fighter | null = null
    for (const f of s.fighters) {
      if (!f.alive) continue
      if ((f.x - g.x) ** 2 + (f.y - g.y) ** 2 <= GEM_PICK_R * GEM_PICK_R) {
        taker = f
        break
      }
    }
    if (!taker) {
      keep.push(g)
      continue
    }
    taker.gems += 1
    taker.maxHp += GEM_HP
    taker.hp += GEM_HP
    if (taker.isPlayer) {
      s.score += SCORE.gem
      events.push('gem')
    }
  }
  s.gems = keep
}

export function tickBursts(s: ArenaState, dt: number): void {
  for (const g of s.gems) g.bobMs += dt * 1000
  if (s.bursts.length === 0) return
  for (const b of s.bursts) b.ms -= dt * 1000
  s.bursts = s.bursts.filter((b) => b.ms > 0)
}

export function aliveCount(s: ArenaState): number {
  let n = 0
  for (const f of s.fighters) if (f.alive) n++
  return n
}
