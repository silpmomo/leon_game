import type { Enemy, EnemyKind, GameState, Player, PowerState } from '../types'
import { TILE, TUNING } from '../engine/tuning'
import { overlaps } from '../engine/aabb'
import {
  breakBrick,
  findTileIn,
  isBrick,
  isDeadly,
  isQuestion,
  isSpike,
  tileAt,
  useQuestion,
} from '../world/tilemap'
import { ENEMY_TUNING, createItem } from '../world/entities'
import { resizePlayer } from '../world/player'
import { SCORE, stompScore } from './score'

export type RuleEvent =
  | 'stomp'
  | 'hurt'
  | 'die'
  | 'coin'
  | 'powerup'
  | 'bump'
  | 'brick'
  | 'fire'
  | 'goal'
  | 'extraLife'
  | 'jump'
  | 'spring'
  | 'bossHit'
  | 'bossDown'
  | 'bolt'

/** 위에서 밟아 없앨 수 있는 적. 악어는 가시가 있고 보스는 너무 크다 */
const STOMPABLE = new Set<EnemyKind>(['broccoli', 'soup', 'flyer'])

export function canStomp(p: Player, e: Enemy): boolean {
  if (!STOMPABLE.has(e.kind)) return false
  if (p.vy <= 0) return false
  return p.y + p.h <= e.y + TUNING.stompGrace
}

function squash(e: Enemy): void {
  e.squashMs = ENEMY_TUNING.squashMs
  e.vx = 0
  e.vy = 0
}

function demote(power: PowerState): PowerState | null {
  // ball 과 bolt 는 같은 등급이다. 둘 다 big 으로 한 단계 내려간다.
  if (power === 'ball' || power === 'bolt') return 'big'
  if (power === 'big') return 'small'
  return null // small → 사망
}

export function hurtPlayer(s: GameState): RuleEvent[] {
  if (s.player.invulnMs > 0) return []
  const next = demote(s.player.power)
  if (next === null) {
    s.deaths += 1
    return ['die']
  }
  resizePlayer(s.player, next)
  s.player.invulnMs = TUNING.invulnMs
  return ['hurt']
}

export function resolveEnemies(s: GameState, jumpHeld = false): RuleEvent[] {
  const events: RuleEvent[] = []
  const p = s.player

  for (const e of s.enemies) {
    if (!e.alive || !e.active || e.squashMs > 0) continue
    if (!overlaps(p, e)) continue

    if (canStomp(p, e)) {
      // 땅을 밟고 있던 상태였다면 콤보 사슬이 끊긴 상태에서 시작한다
      if (p.onGround) s.combo = 0
      s.score += stompScore(s.combo)
      s.combo += 1
      squash(e)
      p.vy = jumpHeld ? TUNING.stompBounceHeld : TUNING.stompBounce
      p.onGround = false
      events.push('stomp')
      continue
    }

    events.push(...hurtPlayer(s))
    break // 한 프레임에 여러 번 다치지 않는다
  }

  return events
}

function takeCoin(s: GameState): RuleEvent[] {
  const events: RuleEvent[] = ['coin']
  s.score += SCORE.coin
  s.coinCount += 1
  if (s.coinCount >= SCORE.coinsPerLife) {
    s.coinCount = 0
    s.lives += 1
    events.push('extraLife')
  }
  return events
}

export function resolveCoins(s: GameState): RuleEvent[] {
  const events: RuleEvent[] = []
  for (const c of s.coins) {
    if (c.taken || !overlaps(s.player, c)) continue
    c.taken = true
    events.push(...takeCoin(s))
  }
  return events
}

export function resolveItems(s: GameState): RuleEvent[] {
  const events: RuleEvent[] = []
  for (const it of s.items) {
    if (it.taken || !overlaps(s.player, it)) continue
    it.taken = true

    if (it.kind === 'peach') {
      if (s.player.power === 'small') resizePlayer(s.player, 'big')
    } else {
      // 무기: small 은 먼저 커지기만 하고, big 이상이면 그 무기를 든다
      const armed = it.kind === 'bolt' ? 'bolt' : 'ball'
      resizePlayer(s.player, s.player.power === 'small' ? 'big' : armed)
    }
    events.push('powerup')
  }
  return events
}

export function resolveBalls(s: GameState): RuleEvent[] {
  const events: RuleEvent[] = []
  for (const b of s.balls) {
    if (!b.alive) continue
    for (const e of s.enemies) {
      if (!e.alive || !e.active || e.squashMs > 0) continue
      if (e.hitCooldownMs > 0) continue
      if (!overlaps(b, e)) continue
      b.alive = false
      e.hp -= 1
      // 쿨다운은 보스에만. 작은 적은 hp 1~2라 쿨다운을 걸면
      // 연속 사격이 막혀 오히려 이상해진다.
      if (e.kind === 'boss') e.hitCooldownMs = ENEMY_TUNING.bossHitCooldownMs
      if (e.kind === 'boss') events.push(e.hp <= 0 ? 'bossDown' : 'bossHit')
      if (e.hp <= 0) {
        e.alive = false
        s.score += e.kind === 'boss' ? SCORE.bossKill : stompScore(0)
      }
      break
    }
  }
  return events
}

/**
 * 전기 빔 판정.
 *
 * 빔은 관통한다 — 일직선상의 적을 한 번에 모두 때린다. 같은 적을 프레임마다
 * 다시 때리지 않도록 이미 맞은 적의 인덱스를 기억한다.
 */
export function resolveBolts(s: GameState): RuleEvent[] {
  const events: RuleEvent[] = []
  for (const b of s.bolts) {
    if (b.ms <= 0) continue
    for (let i = 0; i < s.enemies.length; i++) {
      const e = s.enemies[i]!
      if (!e.alive || !e.active || e.squashMs > 0) continue
      if (b.hit.includes(i)) continue
      if (!overlaps(b, e)) continue

      b.hit.push(i)
      e.hp -= TUNING.boltDamage
      if (e.kind === 'boss') {
        e.hitCooldownMs = ENEMY_TUNING.bossHitCooldownMs
        events.push(e.hp <= 0 ? 'bossDown' : 'bossHit')
      }
      if (e.hp <= 0) {
        e.alive = false
        s.score += e.kind === 'boss' ? SCORE.bossKill : stompScore(0)
      }
    }
  }
  return events
}

/**
 * 가시·용암 타일 판정.
 *
 * 두 타일은 solid 가 아니라 충돌 해소를 거치지 않으므로, 몸이 겹치는 타일을
 * 직접 훑어야 한다. 용암은 무적을 무시하고 즉사시킨다.
 */
export function resolveHazards(s: GameState): RuleEvent[] {
  const p = s.player
  // 발끝만 살짝 닿는 것으로 죽지 않게 히트박스를 조금 줄인다
  const box = { x: p.x + 2, y: p.y + 2, w: p.w - 4, h: p.h - 3 }

  if (findTileIn(s.grid, box, isDeadly, TILE)) {
    s.deaths += 1
    return ['die']
  }
  if (findTileIn(s.grid, box, isSpike, TILE)) return hurtPlayer(s)
  return []
}

/** 아래에서 블록을 쳤을 때 */
export function hitBlock(s: GameState, tx: number, ty: number): RuleEvent[] {
  const events: RuleEvent[] = []
  const t = tileAt(s.grid, tx, ty)

  // 블록 바로 위에 있던 적을 뒤집는다
  const top = { x: tx * TILE, y: (ty - 1) * TILE, w: TILE, h: TILE }
  for (const e of s.enemies) {
    if (!e.alive || e.squashMs > 0) continue
    if (overlaps(e, top)) squash(e)
  }

  s.bumps.push({ tx, ty, ms: 140 })

  if (isQuestion(t)) {
    useQuestion(s.grid, tx, ty)
    if (t === '?') events.push(...takeCoin(s))
    else if (t === '@') {
      s.items.push(createItem('peach', tx, ty - 1, 1))
      events.push('powerup')
    } else if (t === '*') {
      s.items.push(createItem('ball', tx, ty - 1, 1))
      events.push('powerup')
    } else if (t === 'E') {
      s.items.push(createItem('bolt', tx, ty - 1, 1))
      events.push('powerup')
    }
    return events
  }

  if (isBrick(t)) {
    if (s.player.power === 'small') {
      events.push('bump')
      return events
    }
    if (t === 'b') events.push(...takeCoin(s))
    breakBrick(s.grid, tx, ty)
    events.push('brick')
    return events
  }

  events.push('bump')
  return events
}
