import type {
  Ball,
  Bolt,
  Enemy,
  EnemyKind,
  Item,
  LevelEntity,
  Platform,
  Player,
  TileGrid,
} from '../types'
import { TILE, TUNING, VIEW_W } from '../engine/tuning'
import { applyGravity, moveX, moveY } from '../engine/physics'
import { solidAt } from './tilemap'

export const ENEMY_SIZE: Record<EnemyKind, { w: number; h: number }> = {
  broccoli: { w: 12, h: 12 },
  soup: { w: 14, h: 12 },
  crocodile: { w: 26, h: 10 },
  flyer: { w: 14, h: 12 },
  boss: { w: 40, h: 26 },
  spiky: { w: 14, h: 14 },
  thrower: { w: 16, h: 16 },
}

export const ENEMY_TUNING = {
  broccoliSpeed: 40,
  soupJumpVel: -260,
  soupPeriodMs: 1400,
  crocSpeed: 90,
  crocSenseTiles: 8,
  crocHp: 2,
  squashMs: 300,
  ballSpeed: 120,
  ballJumpVel: -120,
  ballMaxBounces: 3,
  itemSpeed: 40,
  platformW: 3 * TILE,
  platformH: 8,

  // 나는 적 — 좌우로 가면서 사인 곡선으로 오르내린다
  flyerSpeed: 55,
  flyerAmpTiles: 1.6,
  flyerPeriodMs: 2000,

  // 보스 — 걷다가 주기적으로 크게 뛴다. 밟기 불가, 축구공 5발
  bossSpeed: 55,
  bossHp: 5,
  bossJumpVel: -300,
  bossJumpPeriodMs: 2200,
  bossHitCooldownMs: 700,
  bossRangeTiles: 9,

  /** 가시 적 — 브로콜리보다 조금 빠르고 밟을 수 없다 */
  spikySpeed: 50,

  /** 던지는 적 — 느리게 걸으며 주기적으로 투사체를 던진다 */
  throwerSpeed: 25,
  throwerPeriodMs: 1800,
  throwerRangeTiles: 10,
  throwerBallVx: 95,
  throwerBallVy: -150,
} as const

export function createEnemy(kind: EnemyKind, tx: number, ty: number, dir: 1 | -1): Enemy {
  const { w, h } = ENEMY_SIZE[kind]
  const x = tx * TILE + (TILE - w) / 2
  return {
    kind,
    dir,
    x,
    y: (ty + 1) * TILE - h,
    vx: 0,
    vy: 0,
    w,
    h,
    onGround: false,
    homeX: x,
    active: false,
    alive: true,
    timerMs: 0,
    hp: HP[kind],
    squashMs: 0,
    homeY: (ty + 1) * TILE - h,
    hitCooldownMs: 0,
  }
}

const HP: Record<EnemyKind, number> = {
  broccoli: 1,
  soup: 1,
  crocodile: ENEMY_TUNING.crocHp,
  flyer: 1,
  boss: ENEMY_TUNING.bossHp,
  spiky: 1,
  thrower: 2,
}

/**
 * 적이 던진 투사체. 플레이어를 때린다.
 * 플레이어의 공과 같은 Ball 을 쓰고 hostile 로 구분한다.
 */
export function createHostileBall(e: Enemy): Ball {
  const size = 10
  return {
    x: e.dir === 1 ? e.x + e.w : e.x - size,
    y: e.y + 2,
    vx: e.dir * ENEMY_TUNING.throwerBallVx,
    vy: ENEMY_TUNING.throwerBallVy,
    w: size,
    h: size,
    onGround: false,
    bounces: 0,
    alive: true,
    hostile: true,
  }
}

/**
 * 적을 갱신하고, 던진 투사체가 있으면 돌려준다.
 * 반환값이 null 이 아니면 호출한 쪽이 s.balls 에 넣는다.
 */
export function updateEnemy(
  e: Enemy,
  grid: TileGrid,
  player: Player,
  dt: number,
): Ball | null {
  if (!e.alive) return null

  // 밟혀서 납작해진 상태 — 잠시 보여주고 사라진다
  if (e.squashMs > 0) {
    e.squashMs -= dt * 1000
    if (e.squashMs <= 0) e.alive = false
    return null
  }

  if (!e.active) return null
  let thrown: Ball | null = null
  if (e.hitCooldownMs > 0) e.hitCooldownMs = Math.max(0, e.hitCooldownMs - dt * 1000)

  switch (e.kind) {
    case 'broccoli':
      e.vx = e.dir * ENEMY_TUNING.broccoliSpeed
      break

    case 'soup': {
      e.vx = 0
      e.timerMs += dt * 1000
      if (e.onGround && e.timerMs >= ENEMY_TUNING.soupPeriodMs) {
        e.vy = ENEMY_TUNING.soupJumpVel
        e.timerMs = 0
      }
      break
    }

    case 'crocodile': {
      // timerMs를 "돌진 중" 플래그로 쓴다 (0보다 크면 돌진 중)
      if (e.timerMs === 0) {
        const dist = Math.abs(player.x + player.w / 2 - (e.x + e.w / 2))
        if (dist <= ENEMY_TUNING.crocSenseTiles * TILE) {
          e.timerMs = 1
          e.dir = player.x < e.x ? -1 : 1
        }
      }
      e.vx = e.timerMs > 0 ? e.dir * ENEMY_TUNING.crocSpeed : 0
      break
    }

    case 'spiky':
      // 브로콜리와 같은 걸음. 밟기 판정에서만 다르다 (rules.ts STOMPABLE)
      e.vx = e.dir * ENEMY_TUNING.spikySpeed
      break

    case 'thrower': {
      e.vx = e.dir * ENEMY_TUNING.throwerSpeed
      e.timerMs += dt * 1000
      const near =
        Math.abs(player.x + player.w / 2 - (e.x + e.w / 2))
        <= ENEMY_TUNING.throwerRangeTiles * TILE
      if (near && e.timerMs >= ENEMY_TUNING.throwerPeriodMs) {
        e.timerMs = 0
        e.dir = player.x < e.x ? -1 : 1
        thrown = createHostileBall(e)
      }
      break
    }

    case 'flyer': {
      // 중력을 받지 않고 사인 곡선으로 오르내린다
      e.timerMs += dt * 1000
      e.vx = e.dir * ENEMY_TUNING.flyerSpeed
      const phase = (e.timerMs / ENEMY_TUNING.flyerPeriodMs) * Math.PI * 2
      const target = e.homeY + Math.sin(phase) * ENEMY_TUNING.flyerAmpTiles * TILE
      e.vy = 0
      if (moveX(e, grid, dt)) e.dir = (e.dir * -1) as 1 | -1
      e.y = target
      e.onGround = false
      return null
    }

    case 'boss': {
      e.timerMs += dt * 1000
      const dist = Math.abs(player.x + player.w / 2 - (e.x + e.w / 2))
      const engaged = dist <= ENEMY_TUNING.bossRangeTiles * TILE
      if (engaged) e.dir = player.x < e.x ? -1 : 1
      e.vx = engaged ? e.dir * ENEMY_TUNING.bossSpeed : 0
      if (e.onGround && e.timerMs >= ENEMY_TUNING.bossJumpPeriodMs) {
        e.vy = ENEMY_TUNING.bossJumpVel
        e.timerMs = 0
      }
      break
    }
  }

  applyGravity(e, dt, false)
  if (moveX(e, grid, dt)) e.dir = (e.dir * -1) as 1 | -1
  moveY(e, grid, dt, false) // 적에게 코너 보정을 켜면 벽을 통과한다
  return thrown
}

export function createPlatform(def: Extract<LevelEntity, { type: 'platform' }>): Platform {
  const x = def.x * TILE
  const y = def.y * TILE
  return {
    x,
    y,
    vx: 0,
    vy: 0,
    w: ENEMY_TUNING.platformW,
    h: ENEMY_TUNING.platformH,
    onGround: false,
    axis: def.axis,
    range: def.range,
    speed: def.speed,
    originX: x,
    originY: y,
    dir: 1,
  }
}

/** 왕복 이동. 반환값은 이번 프레임 이동량 — 위에 탄 몸에 더해진다. */
export function updatePlatform(pf: Platform, dt: number): { dx: number; dy: number } {
  const span = pf.range * TILE
  const delta = pf.dir * pf.speed * dt

  if (pf.axis === 'x') {
    const next = pf.x + delta
    if (next > pf.originX + span || next < pf.originX - span) {
      pf.dir = (pf.dir * -1) as 1 | -1
      return { dx: 0, dy: 0 }
    }
    pf.x = next
    return { dx: delta, dy: 0 }
  }

  const next = pf.y + delta
  if (next > pf.originY + span || next < pf.originY - span) {
    pf.dir = (pf.dir * -1) as 1 | -1
    return { dx: 0, dy: 0 }
  }
  pf.y = next
  return { dx: 0, dy: delta }
}

export function createBall(p: Player): Ball {
  const size = 12
  return {
    x: p.facing === 1 ? p.x + p.w : p.x - size,
    // 세로 중심을 플레이어 중심에 맞춘다. p.y + p.h/2 로 두면 공 하단이
    // 발보다 아래로 내려가 스폰하는 순간 바닥에 박힌다.
    y: p.y + p.h / 2 - size / 2,
    vx: p.facing * ENEMY_TUNING.ballSpeed,
    vy: 0,
    w: 12,
    h: 12,
    onGround: false,
    bounces: 0,
    alive: true,
    hostile: false,
  }
}

export function updateBall(b: Ball, grid: TileGrid, dt: number): void {
  if (!b.alive) return
  applyGravity(b, dt, false)
  if (moveX(b, grid, dt)) {
    b.alive = false // 벽에 닿으면 소멸
    return
  }
  const v = moveY(b, grid, dt, false)
  if (v.hit === 'ground') {
    b.bounces += 1
    if (b.bounces >= ENEMY_TUNING.ballMaxBounces) {
      b.alive = false
      return
    }
    b.vy = ENEMY_TUNING.ballJumpVel
    b.onGround = false
  }
}

/**
 * 전기 빔을 만든다. 투사체가 아니라 발사 순간 벽까지 뻗는 사각형이다.
 *
 * 사거리는 타일을 훑어 첫 solid 앞에서 끊는다. 이렇게 하지 않으면 벽 너머
 * 적까지 맞아서 지형이 의미가 없어진다.
 */
export function createBolt(p: Player, grid: TileGrid): Bolt {
  const h = TUNING.boltHeight
  const cy = p.y + p.h / 2 - h / 2
  const max = TUNING.boltLenTiles * TILE

  // 눈높이 두 줄을 검사해 어느 한 쪽이라도 막히면 거기서 끊는다
  const rows = [Math.floor(cy / TILE), Math.floor((cy + h - 1) / TILE)]
  const originX = p.facing === 1 ? p.x + p.w : p.x
  let len = 0
  while (len < max) {
    const probe = p.facing === 1 ? originX + len : originX - len - 1
    const tx = Math.floor(probe / TILE)
    if (rows.some((ty) => solidAt(grid, tx, ty))) break
    len += 4
  }
  len = Math.max(TILE, Math.min(max, len))

  return {
    x: p.facing === 1 ? originX : originX - len,
    y: cy,
    vx: 0,
    vy: 0,
    w: len,
    h,
    onGround: false,
    dir: p.facing,
    ms: TUNING.boltMs,
    totalMs: TUNING.boltMs,
    hit: [],
  }
}

export function updateBolt(b: Bolt, dt: number): void {
  b.ms -= dt * 1000
}

export function createItem(
  kind: 'peach' | 'ball' | 'bolt',
  tx: number,
  ty: number,
  dir: 1 | -1,
): Item {
  const w = kind === 'peach' ? 14 : kind === 'bolt' ? 14 : 12
  const h = w
  return {
    x: tx * TILE + (TILE - w) / 2,
    y: (ty + 1) * TILE - h,
    vx: kind === 'peach' ? dir * ENEMY_TUNING.itemSpeed : 0,
    vy: 0,
    w,
    h,
    onGround: false,
    kind,
    taken: false,
  }
}

export function updateItem(it: Item, grid: TileGrid, dt: number): void {
  if (it.taken) return
  applyGravity(it, dt, false)
  if (it.kind === 'peach') {
    // moveX 가 막히면 vx를 0으로 만들기 때문에, 진행 방향을 미리 잡아둔다.
    // 나중에 읽으면 Math.sign(0) === 0 이 되어 반전이 아니라 정지가 된다.
    const dir = Math.sign(it.vx) || 1
    if (moveX(it, grid, dt)) it.vx = -dir * ENEMY_TUNING.itemSpeed
  }
  moveY(it, grid, dt, false)
}

export function spawnFromLevel(defs: LevelEntity[]): {
  enemies: Enemy[]
  platforms: Platform[]
} {
  const enemies: Enemy[] = []
  const platforms: Platform[] = []
  for (const d of defs) {
    if (d.type === 'platform') platforms.push(createPlatform(d))
    else enemies.push(createEnemy(d.type, d.x, d.y, d.dir ?? -1))
  }
  return { enemies, platforms }
}

/** 카메라 오른쪽 끝을 지나면 활성화. 한번 켜지면 끄지 않는다. */
export function activateVisible(enemies: Enemy[], camX: number): void {
  const edge = camX + VIEW_W
  for (const e of enemies) {
    if (!e.active && e.homeX <= edge) e.active = true
  }
}
