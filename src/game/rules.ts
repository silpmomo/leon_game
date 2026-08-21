import type { Enemy, EnemyKind, GameState, Player, PowerState } from '../types'
import { TILE, TUNING } from '../engine/tuning'
import { overlaps } from '../engine/aabb'
import { breakBrick, isBrick, isQuestion, tileAt, useQuestion } from '../world/tilemap'
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

const STOMPABLE = new Set<EnemyKind>(['broccoli', 'soup'])

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
  if (power === 'ball') return 'big'
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
      // 축구공: small은 big까지만, big 이상은 ball
      resizePlayer(s.player, s.player.power === 'small' ? 'big' : 'ball')
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
      if (!overlaps(b, e)) continue
      b.alive = false
      e.hp -= 1
      if (e.hp <= 0) {
        e.alive = false
        s.score += stompScore(0)
      }
      break
    }
  }
  return events
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
