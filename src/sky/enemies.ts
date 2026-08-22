import type { Beam, EBullet, EnemyKind, GunSpec, SkyEnemy, WaveSpec } from './types'
import { CULL, SCROLL_SPEED, SKY_H, SKY_W } from './tuning'
import { fire } from './bullets'
import type { Rng } from './rng'

const TAU = Math.PI * 2

/** 적 원형. 크기·체력·점수 */
/**
 * 처음 잡은 체력(새 3, 벌 4…)으로는 화면에 들어오는 순간 녹아서
 * 아무것도 안 보였다. 파워 1단계 기준 0.3초쯤 버티도록 올렸다.
 */
export const ENEMY_BODY: Record<EnemyKind, { w: number; h: number; hp: number; score: number }> = {
  bird: { w: 12, h: 10, hp: 16, score: 100 },
  bee: { w: 12, h: 10, hp: 20, score: 150 },
  kite: { w: 14, h: 14, hp: 42, score: 250 },
  ufo: { w: 16, h: 10, hp: 70, score: 400 },
  rocket: { w: 16, h: 8, hp: 26, score: 300 },
  turret: { w: 16, h: 12, hp: 80, score: 350 },
  blimp: { w: 28, h: 16, hp: 200, score: 900 },
}

/** 편대 한 마리를 만든다. idx 는 편대 안 순번 */
export function spawnEnemy(spec: WaveSpec, idx: number): SkyEnemy {
  const body = ENEMY_BODY[spec.kind]
  const ratio = spec.y + (spec.dy ?? 0) * idx
  // 위아래로 넘치면 화면 안으로 되접는다. 편대가 통째로 사라지지 않게
  const y = 14 + ((ratio % 1) + 1) % 1 * (SKY_H - 34)
  const anchored = spec.path.kind === 'anchor'
  return {
    kind: spec.kind,
    x: SKY_W + body.w / 2 + 4,
    y: anchored ? SKY_H - 14 - body.h / 2 : y,
    y0: anchored ? SKY_H - 14 - body.h / 2 : y,
    w: body.w,
    h: body.h,
    hp: spec.hp ?? body.hp,
    maxHp: spec.hp ?? body.hp,
    t: 0,
    path: spec.path,
    guns: spec.guns,
    gunT: spec.guns.map(firstDelay),
    gunN: spec.guns.map(() => 0),
    hitMs: 0,
    alive: true,
    drop: null,
    score: body.score,
    idx,
  }
}

/** 이동. 경로 종류마다 다르다 */
export function stepEnemy(e: SkyEnemy, dt: number): void {
  e.t += dt * 1000
  const p = e.path
  const s = p.speed
  const secs = e.t / 1000

  switch (p.kind) {
    case 'straight':
      e.x -= s * dt
      break

    case 'sine':
      e.x -= s * dt
      // 편대 순번마다 위상을 어긋내면 물결처럼 보인다
      e.y = e.y0 + (p.amp ?? 16) * Math.sin(TAU * (p.hz ?? 0.7) * secs + e.idx * 0.7)
      break

    case 'hover': {
      const hold = p.holdX ?? SKY_W * 0.7
      const holdMs = p.holdMs ?? 2200
      if (e.x > hold) e.x -= s * dt
      else if (e.t > holdMs + (hold - SKY_W) / -s * 1000) e.x -= s * dt
      break
    }

    case 'swoop': {
      // 한 번 크게 내려갔다 올라오는 S 자. sine 과 달리 반복하지 않는다
      e.x -= s * dt
      const amp = p.amp ?? 44
      const hz = p.hz ?? 0.28
      e.y = e.y0 + amp * (1 - Math.cos(TAU * hz * secs)) / 2
      break
    }

    case 'anchor':
      // 배경과 같은 속도로 흘러 지형에 붙어 있는 것처럼 보인다
      e.x -= SCROLL_SPEED * dt
      break
  }

  if (e.hitMs > 0) e.hitMs = Math.max(0, e.hitMs - dt * 1000)
}

/** 화면 왼쪽으로 완전히 빠졌는가 */
export function enemyGone(e: SkyEnemy): boolean {
  return e.x < -CULL
}

/** 화면 안에 들어와 있어야 쏜다. 밖에서 쏘면 예고 없이 맞는다 */
function canFire(e: SkyEnemy): boolean {
  return e.x < SKY_W - 2 && e.x > -e.w
}

/**
 * 총의 첫 발사까지 걸리는 시간.
 *
 * everyMs 를 그대로 쓰면 발사 간격이 긴 적은 화면을 다 지나도록 한 발도
 * 못 쏜다. 늦어도 0.7초 안에 한 발은 나가게 하고, 총이 여러 개면
 * 조금씩 어긋내 같은 프레임에 몰리지 않게 한다.
 */
export function firstDelay(g: GunSpec, i: number): number {
  return g.delayMs ?? Math.min(g.everyMs, 700) + i * 140
}

/**
 * 총 하나의 다음 발사까지 걸리는 시간.
 * burstShots 발을 연달아 쏘고 restMs 만큼 쉰다.
 */
export function gunInterval(g: GunSpec, shotsFired: number): number {
  const n = g.burstShots ?? 0
  if (n > 0 && shotsFired % n === 0) return g.restMs ?? g.everyMs
  return g.everyMs
}

/** 적의 총을 한 프레임 돌린다 */
export function stepGuns(
  guns: GunSpec[],
  gunT: number[],
  gunN: number[],
  sx: number,
  sy: number,
  px: number,
  py: number,
  out: EBullet[],
  beams: Beam[],
  dt: number,
  rng: Rng,
  /** 탄속 배수. 보스 막판에 조금 빨라진다 */
  speedMul = 1,
): void {
  const ms = dt * 1000
  for (let i = 0; i < guns.length; i++) {
    const g = guns[i]!
    gunT[i] = (gunT[i] ?? 0) - ms
    // 한 프레임에 여러 번 밀렸어도 최대 3발까지만 — 렉이 탄막으로 번지지 않게
    let guard = 0
    while ((gunT[i] ?? 0) <= 0 && guard < 3) {
      const spec = speedMul === 1 ? g : { ...g, speed: (g.speed ?? 120) * speedMul }
      fire(out, beams, spec, sx + (g.ox ?? 0), sy + (g.oy ?? 0), px, py, gunN[i] ?? 0, rng)
      gunN[i] = (gunN[i] ?? 0) + 1
      gunT[i] = (gunT[i] ?? 0) + gunInterval(g, gunN[i] ?? 0)
      guard++
    }
  }
}

/** 적 하나의 발사 */
export function enemyFire(
  e: SkyEnemy,
  px: number,
  py: number,
  out: EBullet[],
  beams: Beam[],
  dt: number,
  rng: Rng,
): void {
  if (!canFire(e)) {
    // 화면 밖에서는 타이머만 흘려보내지 않는다 — 들어오자마자 쏟아지면 곤란
    return
  }
  stepGuns(e.guns, e.gunT, e.gunN, e.x, e.y, px, py, out, beams, dt, rng)
}
