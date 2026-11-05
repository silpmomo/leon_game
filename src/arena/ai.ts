import type { ArenaState, BotBrain, BotDifficulty, Fighter } from './types'
import type { Rng } from '../sky/rng'
import { canSee, inGas, nearestCrate, safeRect } from './combat'
import { clearShot, nextStep } from './grid'
import { TILE, WEAPONS, WORLD_H, WORLD_W } from './tuning'

/**
 * 봇 판단.
 *
 * 우선순위: 독안개 피하기 → (약하면) 물러나기 → 싸우기 → 별 줍기 → 상자 → 배회.
 * 판단은 difficulty.thinkMs 마다 한 번, 걸음은 매 프레임.
 * 테스트에서는 리온에게도 같은 두뇌를 붙여 "봇 리온"으로 판을 끝까지 돌린다.
 */

export type BotIntent = {
  mx: number
  my: number
  /** null 이면 안 쏜다 */
  aim: [number, number] | null
  super: boolean
}

export function newBrain(): BotBrain {
  return { thinkMs: 0, goalX: 0, goalY: 0, wayX: 0, wayY: 0, target: -1, strafe: 1 }
}

function clampToSafe(s: ArenaState, x: number, y: number): [number, number] {
  const r = safeRect(s.t + 4)
  const m = TILE
  return [
    Math.max(r.x0 + m, Math.min(r.x1 - m, x)),
    Math.max(r.y0 + m, Math.min(r.y1 - m, y)),
  ]
}

function nearestEnemy(s: ArenaState, f: Fighter, within: number): Fighter | null {
  let best: Fighter | null = null
  let bestD = within
  for (const o of s.fighters) {
    if (o === f || !o.alive || !canSee(s, f, o)) continue
    const d = Math.hypot(o.x - f.x, o.y - f.y)
    if (d < bestD) {
      best = o
      bestD = d
    }
  }
  return best
}

function nearestGem(s: ArenaState, f: Fighter, within: number): [number, number] | null {
  let best: [number, number] | null = null
  let bestD = within
  for (const g of s.gems) {
    if (inGas(s.t + 3, g.x, g.y)) continue
    const d = Math.hypot(g.x - f.x, g.y - f.y)
    if (d < bestD) {
      best = [g.x, g.y]
      bestD = d
    }
  }
  return best
}

function setGoal(s: ArenaState, f: Fighter, b: BotBrain, x: number, y: number): void {
  b.goalX = x
  b.goalY = y
  const step = nextStep(s.grid, f.x, f.y, x, y)
  if (step) {
    b.wayX = step[0]
    b.wayY = step[1]
  } else {
    b.wayX = f.x
    b.wayY = f.y
  }
}

function think(s: ArenaState, f: Fighter, b: BotBrain, d: BotDifficulty, rng: Rng): void {
  b.thinkMs = d.thinkMs * (0.8 + rng.f() * 0.4)
  b.target = -1

  // 1) 독안개 — 안에 있거나 곧 덮칠 자리면 가운데로
  if (inGas(s.t + 2.5, f.x, f.y)) {
    setGoal(s, f, b, WORLD_W / 2 + rng.range(-20, 20), WORLD_H / 2 + rng.range(-14, 14))
    return
  }

  const w = WEAPONS[f.weapon]
  const enemy = nearestEnemy(s, f, d.aggro + w.range * 0.4)
  if (enemy) {
    b.target = enemy.id
    const dx = f.x - enemy.x
    const dy = f.y - enemy.y
    const dist = Math.hypot(dx, dy) || 1

    // 2) 약하면 물러난다 — 상대보다 체력이 적을 때만
    if (f.hp / f.maxHp < d.fleeAt && enemy.hp > f.hp) {
      const [gx, gy] = clampToSafe(s, f.x + (dx / dist) * 70, f.y + (dy / dist) * 70)
      setGoal(s, f, b, gx, gy)
      return
    }

    // 3) 사거리 70% 거리를 유지하며 옆걸음
    const want = w.range * 0.7
    if (rng.f() < 0.25) b.strafe = -b.strafe
    if (dist > want) {
      setGoal(s, f, b, enemy.x, enemy.y)
    } else {
      const px = -dy / dist
      const py = dx / dist
      const back = dist < want * 0.6 ? 18 : 0
      const [gx, gy] = clampToSafe(
        s,
        f.x + px * 26 * b.strafe + (dx / dist) * back,
        f.y + py * 26 * b.strafe + (dy / dist) * back,
      )
      setGoal(s, f, b, gx, gy)
    }
    return
  }

  // 4) 별
  const gem = nearestGem(s, f, 150)
  if (gem) {
    setGoal(s, f, b, gem[0], gem[1])
    return
  }

  // 5) 상자 — 사거리 끝에서 멈춰 쏜다
  const crate = farCrate(s, f)
  if (crate && !inGas(s.t + 4, crate[0], crate[1])) {
    setGoal(s, f, b, crate[0], crate[1])
    return
  }

  // 6) 배회 — 안전지대 안 아무 곳
  const r = safeRect(s.t + 6)
  setGoal(
    s, f, b,
    rng.range(r.x0 + TILE, r.x1 - TILE),
    rng.range(r.y0 + TILE, r.y1 - TILE),
  )
}

/** 시야와 상관없이 가장 가까운 상자 (길찾기 목표용) */
function farCrate(s: ArenaState, f: Fighter): [number, number] | null {
  const g = s.grid
  let best: [number, number] | null = null
  let bestD = Infinity
  for (let i = 0; i < g.cells.length; i++) {
    if (g.cells[i] !== 'x') continue
    const tx = i % g.w
    const ty = (i - tx) / g.w
    const px = (tx + 0.5) * TILE
    const py = (ty + 0.5) * TILE
    const d = Math.hypot(px - f.x, py - f.y)
    if (d < bestD) {
      best = [px, py]
      bestD = d
    }
  }
  return best
}

export function botIntent(
  s: ArenaState, f: Fighter, dt: number, d: BotDifficulty, rng: Rng,
): BotIntent {
  const b = f.brain ?? (f.brain = newBrain())
  b.thinkMs -= dt * 1000
  if (b.thinkMs <= 0) think(s, f, b, d, rng)

  // 경유점에 닿으면 다음 경유점
  if (Math.hypot(b.wayX - f.x, b.wayY - f.y) < 2) {
    const step = nextStep(s.grid, f.x, f.y, b.goalX, b.goalY)
    if (step) {
      b.wayX = step[0]
      b.wayY = step[1]
    }
  }

  let mx = b.wayX - f.x
  let my = b.wayY - f.y
  const ml = Math.hypot(mx, my)
  if (ml < 1.5) {
    mx = 0
    my = 0
  } else {
    mx /= ml
    my /= ml
  }

  const w = WEAPONS[f.weapon]
  let aim: [number, number] | null = null
  let useSuper = false
  const target = b.target >= 0 ? s.fighters[b.target] : undefined
  if (target && target.alive && canSee(s, f, target)) {
    const dist = Math.hypot(target.x - f.x, target.y - f.y)
    if (dist <= w.range * 1.05 && clearShot(s.grid, f.x, f.y, target.x, target.y)) {
      const a = Math.atan2(target.y - f.y, target.x - f.x) + rng.range(-d.aimError, d.aimError)
      aim = [Math.cos(a), Math.sin(a)]
    }
    if (f.superCharge >= 1 && dist <= w.ringRange * 0.75) useSuper = true
  } else if (b.target < 0) {
    const crate = nearestCrate(s, f.x, f.y, w.range * 0.95)
    if (crate) aim = [crate[0] - f.x, crate[1] - f.y]
  }
  return { mx, my, aim, super: useSuper }
}
