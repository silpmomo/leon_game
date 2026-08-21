import type { GameState, InputState, LevelData, Mode, Platform } from '../types'
import { EMPTY_INPUT } from '../types'
import { TILE, TUNING } from '../engine/tuning'
import { updateCamera } from '../engine/camera'
import { isSpring, parseTiles, tileAt } from '../world/tilemap'
import { createPlayer, updatePlayer } from '../world/player'
import {
  activateVisible,
  createBall,
  createBolt,
  spawnFromLevel,
  updateBall,
  updateBolt,
  updateEnemy,
  updateItem,
  updatePlatform,
} from '../world/entities'
import {
  hitBlock,
  resolveBalls,
  resolveBolts,
  resolveCoins,
  resolveEnemies,
  resolveHazards,
  resolveItems,
  type RuleEvent,
} from './rules'

export const MAX_BALLS = 2
export const CHALLENGE_TIME_MS = 400_000

export function newGameState(level: LevelData, mode: Mode): GameState {
  const { grid, coins } = parseTiles(level.tiles)
  const { enemies, platforms } = spawnFromLevel(level.entities)
  return {
    scene: 'playing',
    mode,
    level,
    grid,
    player: createPlayer(level.spawn.x, level.spawn.y),
    enemies,
    coins,
    items: [],
    balls: [],
    bolts: [],
    platforms,
    bumps: [],
    camera: { x: 0, y: 0 },
    coinCount: 0,
    score: 0,
    lives: mode === 'challenge' ? 3 : Number.POSITIVE_INFINITY,
    timeMs: mode === 'challenge' ? CHALLENGE_TIME_MS : 0,
    deaths: 0,
    combo: 0,
    checkpointX: level.spawn.x,
    sceneMs: 0,
    flashMs: 0,
    boltCooldownMs: 0,
    muted: false,
  }
}

/**
 * 살아 있는 플레이어 공의 수.
 * 적이 던진 것(hostile)은 세지 않는다 — 세면 적의 투사체가 날아다니는 동안
 * 플레이어가 발사를 못 하게 막힌다.
 */
function aliveBalls(s: GameState): number {
  return s.balls.reduce((n, b) => n + (b.alive && !b.hostile ? 1 : 0), 0)
}

/** 발판 위에 서 있는가 — 발밑 2px 안에 발판 상단이 있는 경우 */
function isRiding(s: GameState, pf: Platform): boolean {
  const p = s.player
  const feet = p.y + p.h
  const horizontal = p.x + p.w > pf.x && p.x < pf.x + pf.w
  return horizontal && Math.abs(feet - pf.y) <= 2 && p.vy >= 0
}

/** 이번 프레임에 발판 위로 착지했는가 — 아래에서 위로는 통과시킨다 (단방향) */
function landsOn(s: GameState, pf: Platform): boolean {
  const p = s.player
  if (p.vy < 0) return false
  const horizontal = p.x + p.w > pf.x && p.x < pf.x + pf.w
  if (!horizontal) return false
  const feet = p.y + p.h
  return feet >= pf.y && feet <= pf.y + pf.h + 4
}

/**
 * 한 프레임. 순서는 스펙 §3.3에 고정되어 있다.
 * 시간 → 발판 → 플레이어 → 발사 → 엔티티 → 규칙 → 골/낙하 → 체크포인트 → 카메라 → 정리
 */
export function updateFrame(s: GameState, input: InputState, dt: number): RuleEvent[] {
  const events: RuleEvent[] = []
  const ms = dt * 1000

  // ── 1. 시간
  if (s.mode === 'challenge') {
    s.timeMs = Math.max(0, s.timeMs - ms)
    if (s.timeMs === 0) {
      s.deaths += 1
      return ['die']
    }
  } else {
    s.timeMs += ms
  }

  // 깃대를 잡으면 조작이 먹지 않는다
  const effective: InputState = s.player.sliding ? { ...EMPTY_INPUT } : input

  // ── 2. 발판을 먼저 움직인다. 위에 탄 몸이 따라가야 하므로 이동량을 기억한다.
  const rides = s.platforms.map((pf) => ({ pf, ...updatePlatform(pf, dt) }))
  for (const { pf, dx, dy } of rides) {
    if (!isRiding(s, pf)) continue
    s.player.x += dx
    s.player.y += dy
  }

  // ── 3. 플레이어
  const step = updatePlayer(s.player, effective, s.grid, dt)
  if (step.jumped) events.push('jump')

  // 발판 착지 판정 (타일이 아니므로 별도로 본다)
  for (const { pf } of rides) {
    if (landsOn(s, pf)) {
      s.player.y = pf.y - s.player.h
      s.player.vy = 0
      s.player.onGround = true
      s.player.coyoteMs = TUNING.coyoteMs
    }
  }

  if (step.vertical.hit === 'ceiling') {
    events.push(...hitBlock(s, step.vertical.tx, step.vertical.ty))
  }
  if (step.landed) s.combo = 0

  // ── 3.5 점프대: 위에서 밟으면 최고 점프보다 높이 튕긴다
  if (step.vertical.hit === 'ground' && isSpring(tileAt(s.grid, step.vertical.tx, step.vertical.ty))) {
    s.player.vy = TUNING.springVel
    s.player.onGround = false
    s.player.rising = true
    s.combo = 0
    events.push('spring')
  }

  // ── 4. 무기 발사
  if (s.boltCooldownMs > 0) s.boltCooldownMs = Math.max(0, s.boltCooldownMs - ms)
  if (s.flashMs > 0) s.flashMs = Math.max(0, s.flashMs - ms)

  if (effective.firePressed) {
    if (s.player.power === 'ball' && aliveBalls(s) < MAX_BALLS) {
      s.balls.push(createBall(s.player))
      events.push('fire')
    } else if (s.player.power === 'bolt' && s.boltCooldownMs === 0) {
      s.bolts.push(createBolt(s.player, s.grid))
      s.boltCooldownMs = TUNING.boltCooldownMs
      s.flashMs = TUNING.flashMs
      events.push('bolt')
    }
  }

  // ── 5. 엔티티. 던지는 적은 투사체를 돌려주므로 목록에 넣는다.
  for (const e of s.enemies) {
    const thrown = updateEnemy(e, s.grid, s.player, dt)
    if (thrown) s.balls.push(thrown)
  }
  for (const it of s.items) updateItem(it, s.grid, dt)
  for (const b of s.balls) updateBall(b, s.grid, dt)
  for (const b of s.bolts) updateBolt(b, dt)

  // ── 6. 규칙
  events.push(...resolveCoins(s))
  events.push(...resolveItems(s))
  events.push(...resolveBalls(s))
  events.push(...resolveBolts(s))
  events.push(...resolveEnemies(s, effective.jump))
  events.push(...resolveHazards(s))

  // ── 7. 골: 깃대 x를 넘으면 슬라이딩 시작
  if (!s.player.sliding && s.player.x + s.player.w / 2 >= s.level.goal.x * TILE) {
    s.player.sliding = true
    events.push('goal')
  }

  // ── 8. 낙하사
  if (s.player.y > s.level.height * TILE + TUNING.deathFallMargin) {
    s.deaths += 1
    events.push('die')
  }

  // ── 9. 체크포인트
  const playerTx = Math.floor((s.player.x + s.player.w / 2) / TILE)
  for (const cp of s.level.checkpoints) {
    if (playerTx >= cp && cp > s.checkpointX) s.checkpointX = cp
  }

  // ── 10. 카메라와 스폰
  updateCamera(s.camera, s.player, s.level.width * TILE)
  activateVisible(s.enemies, s.camera.x)

  // ── 11. 정리
  for (const b of s.bumps) b.ms -= ms
  s.bumps = s.bumps.filter((b) => b.ms > 0)
  s.enemies = s.enemies.filter((e) => e.alive)
  s.coins = s.coins.filter((c) => !c.taken)
  s.items = s.items.filter((it) => !it.taken)
  s.balls = s.balls.filter((b) => b.alive)
  s.bolts = s.bolts.filter((b) => b.ms > 0)

  return events
}
