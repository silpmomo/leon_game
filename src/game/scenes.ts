import type { BestRecord, GameState } from '../types'
import { TILE } from '../engine/tuning'
import { createPlayer } from '../world/player'
import { spawnFromLevel } from '../world/entities'
import { flagBonus, timeBonus } from './score'
import { CHALLENGE_TIME_MS } from './update'
import type { RuleEvent } from './rules'

export const DEAD_MS = 1200
export const CLEAR_MS = 2500

export function respawn(s: GameState): void {
  const tx = s.mode === 'practice' ? s.checkpointX : s.level.spawn.x
  s.player = createPlayer(tx, s.level.spawn.y)

  // 적과 발판은 원래 자리로 되살린다. 먹은 코인·부순 블록은 그대로 둔다.
  const { enemies, platforms } = spawnFromLevel(s.level.entities)
  s.enemies = enemies
  s.platforms = platforms
  s.items = []
  s.balls = []
  s.bumps = []
  s.combo = 0
  if (s.mode === 'challenge') s.timeMs = CHALLENGE_TIME_MS
}

export function advanceScene(s: GameState, events: RuleEvent[], dt: number): void {
  const ms = dt * 1000

  if (s.scene === 'playing') {
    if (events.includes('goal')) {
      s.score += flagBonus(
        s.player.y,
        s.level.goal.flagTop * TILE,
        (s.level.height - 2) * TILE,
      )
      if (s.mode === 'challenge') s.score += timeBonus(s.timeMs)
      s.scene = 'clear'
      s.sceneMs = CLEAR_MS
      return
    }
    if (events.includes('die')) {
      if (s.mode === 'challenge') s.lives -= 1
      s.scene = 'dead'
      s.sceneMs = DEAD_MS
    }
    return
  }

  if (s.scene === 'dead') {
    s.sceneMs -= ms
    if (s.sceneMs > 0) return
    if (s.mode === 'challenge' && s.lives <= 0) {
      s.scene = 'gameover'
      s.sceneMs = 0
      return
    }
    respawn(s)
    s.scene = 'playing'
    return
  }

  // clear · gameover · title 은 사용자 입력을 기다린다
  if (s.sceneMs > 0) s.sceneMs = Math.max(0, s.sceneMs - ms)
}

export function finalScore(s: GameState): number {
  return s.score
}

export function toRecord(s: GameState, prev: BestRecord): BestRecord {
  if (s.scene !== 'clear') return prev

  const elapsed = s.mode === 'practice' ? s.timeMs : CHALLENGE_TIME_MS - s.timeMs
  const score = finalScore(s)

  return {
    cleared: true,
    bestScore: Math.max(prev.bestScore, score),
    bestTimeMs: prev.bestTimeMs === 0 ? elapsed : Math.min(prev.bestTimeMs, elapsed),
    fewestDeaths: prev.cleared ? Math.min(prev.fewestDeaths, s.deaths) : s.deaths,
  }
}
