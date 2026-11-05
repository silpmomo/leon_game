import type { BestRecord } from '../types'
import type { ArenaEvent, ArenaState } from './types'
import { CLEAR_MS, DEAD_MS, SCORE } from './tuning'

/**
 * 씬 전이. countdown → playing → (dead → gameover | clear)
 *
 * 리온이 쓰러지면 남은 봇끼리 끝까지 싸우게 두지 않는다. 순위는
 * 쓰러진 순간 정해지고, 아이는 바로 결과를 본다.
 */
export function advanceArenaScene(s: ArenaState, events: ArenaEvent[], dt: number): void {
  const ms = dt * 1000

  if (s.scene === 'countdown') {
    s.sceneMs -= ms
    if (s.sceneMs <= 0) {
      s.scene = 'playing'
      s.sceneMs = 0
    }
    return
  }

  if (s.scene === 'playing') {
    if (events.includes('win')) {
      s.scene = 'clear'
      s.sceneMs = CLEAR_MS
      s.score += rankBonus(1)
      return
    }
    if (events.includes('die')) {
      s.scene = 'dead'
      s.sceneMs = DEAD_MS
      s.score += rankBonus(s.fighters[0]!.rank)
    }
    return
  }

  if (s.scene === 'dead') {
    s.sceneMs -= ms
    if (s.sceneMs <= 0) {
      s.scene = 'gameover'
      s.sceneMs = 0
    }
    return
  }

  if (s.scene === 'clear') s.sceneMs = Math.max(0, s.sceneMs - ms)
}

export function rankBonus(rank: number): number {
  return SCORE.rank[rank] ?? 0
}

/** 지금 리온의 순위. 살아 있으면 남은 인원 수 */
export function playerRank(s: ArenaState): number {
  const p = s.fighters[0]!
  if (p.rank > 0) return p.rank
  return s.fighters.filter((f) => f.alive).length
}

/** 1등만 클리어로 친다 — 다음 판이 열린다 */
export function arenaToRecord(s: ArenaState, prev: BestRecord): BestRecord {
  if (s.scene !== 'clear') {
    return { ...prev, bestScore: Math.max(prev.bestScore, s.score) }
  }
  const time = Math.round(s.t * 1000)
  return {
    cleared: true,
    bestScore: Math.max(prev.bestScore, s.score),
    bestTimeMs: prev.bestTimeMs === 0 ? time : Math.min(prev.bestTimeMs, time),
    fewestDeaths: 0,
  }
}
