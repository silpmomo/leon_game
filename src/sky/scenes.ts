import type { BestRecord } from '../types'
import type { SkyEvent, SkyState } from './types'
import { CLEAR_MS, DEAD_MS, SCORE } from './tuning'
import { respawnSky } from './update'

/**
 * 씬 전이. updateSky 가 낸 이벤트를 받아 처리한다.
 * 기존 게임의 game/scenes.ts 와 같은 구조로 맞췄다.
 */
export function advanceSkyScene(s: SkyState, events: SkyEvent[], dt: number): void {
  const ms = dt * 1000

  if (s.scene === 'clear') {
    if (s.sceneMs === 0) {
      // 클리어 보너스는 한 번만 얹는다
      s.sceneMs = CLEAR_MS
      s.score += s.player.bombs * SCORE.bombLeft
      if (s.deaths === 0) s.score += SCORE.noMiss
    } else {
      s.sceneMs = Math.max(0, s.sceneMs - ms)
    }
    return
  }

  if (s.scene === 'playing' && events.includes('die')) {
    s.scene = 'dead'
    s.sceneMs = DEAD_MS
    return
  }

  if (s.scene === 'dead') {
    s.sceneMs -= ms
    if (s.sceneMs > 0) return
    if (s.lives <= 0) {
      s.scene = 'gameover'
      s.sceneMs = 0
      return
    }
    respawnSky(s)
    s.scene = 'playing'
    s.sceneMs = 0
  }
}

export function skyFinalScore(s: SkyState): number {
  return s.score
}

/** 기존 게임과 같은 BestRecord 형태로 남긴다 — 허브가 그대로 읽는다 */
export function skyToRecord(s: SkyState, prev: BestRecord): BestRecord {
  if (s.scene !== 'clear') return prev
  const time = Math.round(s.t)
  return {
    cleared: true,
    bestScore: Math.max(prev.bestScore, s.score),
    bestTimeMs: prev.bestTimeMs === 0 ? time : Math.min(prev.bestTimeMs, time),
    fewestDeaths: prev.cleared ? Math.min(prev.fewestDeaths, s.deaths) : s.deaths,
  }
}
