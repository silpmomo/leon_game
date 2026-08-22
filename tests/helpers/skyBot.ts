import type { SkyState } from '../../src/sky/types'
import type { SkyInput } from '../../src/sky/player'
import { updateSky } from '../../src/sky/update'
import { advanceSkyScene } from '../../src/sky/scenes'
import { BOUND, SKY_H } from '../../src/sky/tuning'

/**
 * 아주 단순한 자동 조작.
 *
 * 사람만큼 잘 피하지는 못한다. "이 스테이지가 사람이 손댈 여지가 있는가" 를
 * 보는 용도다 — 봇이 1탄에서 계속 죽으면 아이는 절대 못 깬다.
 */
export function skyBot(s: SkyState, frame: number): SkyInput {
  const p = s.player
  // 보스가 있으면 높이를 맞춰 때리고, 없으면 위아래로 훑는다
  const target = s.boss && s.boss.alive
    ? s.boss.y
    : SKY_H / 2 + Math.sin(frame / 34) * 56
  let tx = 74
  let ty = target

  // 가까운 탄에서 밀려난다
  let rx = 0
  let ry = 0
  for (const b of s.bullets) {
    const dx = p.x - b.x
    const dy = p.y - b.y
    const d = Math.hypot(dx, dy)
    if (d > 52 || d < 0.01) continue
    const w = (52 - d) / 52
    rx += (dx / d) * w * 70
    ry += (dy / d) * w * 70
  }
  // 적 본체도 피한다
  for (const e of s.enemies) {
    const dx = p.x - e.x
    const dy = p.y - e.y
    const d = Math.hypot(dx, dy)
    if (d > 34 || d < 0.01) continue
    rx += (dx / d) * 40
    ry += (dy / d) * 40
  }
  tx = Math.max(BOUND.x0, Math.min(BOUND.x1, tx + rx))
  ty = Math.max(BOUND.y0, Math.min(BOUND.y1, ty + ry))

  // 탄이 너무 몰리면 궁극기를 쓴다
  const near = s.bullets.filter(
    (b) => Math.hypot(p.x - b.x, p.y - b.y) < 46,
  ).length
  return { tx, ty, ax: 0, ay: 0, bomb: near >= 6 && p.bombs > 0 }
}

export type PlayResult = { cleared: boolean; deaths: number; secs: number; score: number }

/** 봇으로 한 판 돌린다 */
export function playStage(s: SkyState, maxSecs: number): PlayResult {
  const DT = 1 / 60
  const frames = Math.ceil(maxSecs * 60)
  for (let i = 0; i < frames; i++) {
    const ev = updateSky(s, skyBot(s, i), DT)
    advanceSkyScene(s, ev, DT)
    if (s.scene === 'clear' || s.scene === 'gameover') {
      return { cleared: s.scene === 'clear', deaths: s.deaths, secs: i / 60, score: s.score }
    }
  }
  return { cleared: false, deaths: s.deaths, secs: maxSecs, score: s.score }
}

/**
 * 상태 지문. 물리를 건드리면 값이 바뀐다.
 * 기존 게임의 traceHash 와 같은 목적이다.
 */
export function skyTrace(s: SkyState): number {
  let h = 2166136261
  const mix = (v: number): void => {
    h ^= Math.round(v * 1000) | 0
    h = Math.imul(h, 16777619)
  }
  mix(s.player.x)
  mix(s.player.y)
  mix(s.player.power)
  mix(s.player.bombs)
  mix(s.score)
  mix(s.deaths)
  mix(s.bullets.length)
  mix(s.enemies.length)
  mix(s.shots.length)
  for (const b of s.bullets) {
    mix(b.x)
    mix(b.y)
  }
  for (const e of s.enemies) {
    mix(e.x)
    mix(e.y)
    mix(e.hp)
  }
  return h >>> 0
}
