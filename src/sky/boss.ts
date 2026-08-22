import type { Beam, BossSpec, EBullet, SkyBoss } from './types'
import { BOSS_DIE_MS, BOSS_ENTER_MS, BOSS_MORPH_MS, SKY_H, SKY_W } from './tuning'
import { firstDelay, stepGuns } from './enemies'
import type { Rng } from './rng'

const TAU = Math.PI * 2

/** 보스가 자리잡는 곳 */
export function bossHome(w: number): number {
  // 오른쪽 끝에 너무 붙으면 몸이 잘리고 궁극기 버튼과 겹친다
  return SKY_W - w / 2 - 34
}

export function spawnBoss(spec: BossSpec): SkyBoss {
  const first = spec.phases[0]!
  return {
    name: spec.name,
    x: SKY_W + spec.w,
    y: SKY_H / 2,
    w: spec.w,
    h: spec.h,
    hp: first.hp,
    phase: 0,
    phases: spec.phases,
    t: 0,
    gunT: first.guns.map(firstDelay),
    gunN: first.guns.map(() => 0),
    hitMs: 0,
    enterMs: BOSS_ENTER_MS,
    morphMs: 0,
    dieMs: 0,
    alive: true,
    dir: 1,
  }
}

export function bossPhase(b: SkyBoss): SkyBoss['phases'][number] {
  return b.phases[Math.min(b.phase, b.phases.length - 1)]!
}

/** 페이즈 전체를 통틀어 얼마나 남았는가 (0..1). 체력바에 쓴다 */
export function bossHpRatio(b: SkyBoss): number {
  const total = b.phases.reduce((s, p) => s + p.hp, 0)
  let left = b.hp
  for (let i = b.phase + 1; i < b.phases.length; i++) left += b.phases[i]!.hp
  return Math.max(0, Math.min(1, left / total))
}

/** 보스를 한 프레임 진행. 이동 → 발사 순 */
export function stepBoss(
  b: SkyBoss,
  px: number,
  py: number,
  out: EBullet[],
  beams: Beam[],
  dt: number,
  rng: Rng,
  speedMul: number,
): void {
  const ms = dt * 1000
  b.t += ms
  if (b.hitMs > 0) b.hitMs = Math.max(0, b.hitMs - ms)

  if (b.dieMs > 0) {
    b.dieMs -= ms
    b.x += 8 * dt
    return
  }

  const home = bossHome(b.w)

  if (b.enterMs > 0) {
    b.enterMs -= ms
    const k = 1 - Math.max(0, b.enterMs) / BOSS_ENTER_MS
    // 부드럽게 감속하며 들어온다
    const ease = 1 - (1 - k) * (1 - k)
    b.x = SKY_W + b.w - (SKY_W + b.w - home) * ease
    b.y = SKY_H / 2
    return
  }

  if (b.morphMs > 0) {
    b.morphMs -= ms
    // 변신 중에는 제자리에서 떨기만 한다
    b.x = home + Math.sin(b.t / 26) * 2
    return
  }

  const ph = bossPhase(b)
  const secs = b.t / 1000

  switch (ph.move) {
    case 'hover':
      b.x = home + Math.sin(secs * 1.1) * 6
      b.y = SKY_H / 2 + Math.sin(secs * 0.8) * 26
      break

    case 'sweep': {
      const top = b.h / 2 + 8
      const bot = SKY_H - b.h / 2 - 10
      b.y += b.dir * 52 * dt
      if (b.y < top) {
        b.y = top
        b.dir = 1
      } else if (b.y > bot) {
        b.y = bot
        b.dir = -1
      }
      b.x = home + Math.sin(secs * 1.6) * 10
      break
    }

    case 'charge': {
      // 7초 주기로 왼쪽까지 밀고 들어왔다 되돌아간다
      const cyc = (secs % 7) / 7
      const k = cyc < 0.45 ? cyc / 0.45 : 1 - (cyc - 0.45) / 0.55
      const smooth = k * k * (3 - 2 * k)
      b.x = home - smooth * (home - b.w / 2 - 40)
      b.y += (py - b.y) * Math.min(1, 1.4 * dt)
      break
    }

    case 'circle':
      b.x = home - 16 + Math.cos(secs * 1.3) * 20
      b.y = SKY_H / 2 + Math.sin(secs * 1.3) * 34
      break
  }

  b.y = Math.max(b.h / 2 + 6, Math.min(SKY_H - b.h / 2 - 8, b.y))

  stepGuns(ph.guns, b.gunT, b.gunN, b.x, b.y, px, py, out, beams, dt, rng, speedMul)
}

export type BossHit = 'none' | 'hit' | 'phase' | 'dead'

/** 보스에게 피해. 페이즈가 끝나면 변신하고, 마지막 페이즈면 죽는다 */
export function damageBoss(b: SkyBoss, dmg: number): BossHit {
  if (!b.alive || b.enterMs > 0 || b.morphMs > 0 || b.dieMs > 0) return 'none'
  b.hp -= dmg
  b.hitMs = 90
  if (b.hp > 0) return 'hit'

  if (b.phase + 1 < b.phases.length) {
    b.phase += 1
    const ph = bossPhase(b)
    b.hp = ph.hp
    b.morphMs = BOSS_MORPH_MS
    b.gunT = ph.guns.map(firstDelay)
    b.gunN = ph.guns.map(() => 0)
    b.dir = 1
    return 'phase'
  }

  b.hp = 0
  b.dieMs = BOSS_DIE_MS
  return 'dead'
}

/** 격파 연출까지 끝났는가 */
export function bossFinished(b: SkyBoss): boolean {
  return b.hp <= 0 && b.dieMs <= 0
}
