import type { GameState, InputState, LevelData, Mode, PowerState, Scene } from '../types'
import { DT } from '../engine/tuning'
import { newGameState, updateFrame } from './update'
import { advanceScene } from './scenes'

export type Frame = { l: 0 | 1; r: 0 | 1; j: 0 | 1; f: 0 | 1 }
export type Replay = { level: string; mode: Mode; frames: Frame[] }

export type Snapshot = {
  x: number
  y: number
  power: PowerState
  score: number
  coinCount: number
  deaths: number
  enemiesLeft: number
  scene: Scene
  frames: number
  /**
   * 매 프레임 상태를 누적한 해시.
   *
   * 최종 상태만 비교하면 물리 변경을 놓칠 수 있다 — 도중에 죽어 체크포인트에서
   * 부활하면 그 이전 궤적의 차이가 전부 씻겨 나가기 때문이다. 궤적 자체를
   * 해시로 남겨야 한 프레임의 차이도 잡힌다.
   */
  traceHash: number
}

const NONE: Frame = { l: 0, r: 0, j: 0, f: 0 }

export function toInput(f: Frame, prev: Frame): InputState {
  return {
    left: f.l === 1,
    right: f.r === 1,
    jump: f.j === 1,
    jumpPressed: f.j === 1 && prev.j === 0,
    firePressed: f.f === 1 && prev.f === 0,
  }
}

/** 좌표를 1/100 단위로 잘라 부동소수 오차가 스냅샷을 흔들지 않게 한다 */
function round2(v: number): number {
  return Math.round(v * 100) / 100
}

/** FNV-1a 변형. 결정적이어야 하므로 부동소수를 1/100 단위 정수로 접는다. */
function hashStep(h: number, ...vals: number[]): number {
  let out = h
  for (const v of vals) {
    out ^= Math.round(v * 100) | 0
    out = Math.imul(out, 16777619) >>> 0
  }
  return out
}

const POWER_CODE = { small: 1, big: 2, ball: 3, bolt: 4 } as const

export function snapshot(s: GameState, frames: number, traceHash: number): Snapshot {
  return {
    x: round2(s.player.x),
    y: round2(s.player.y),
    power: s.player.power,
    score: s.score,
    coinCount: s.coinCount,
    deaths: s.deaths,
    enemiesLeft: s.enemies.filter((e) => e.alive).length,
    scene: s.scene,
    frames,
    traceHash,
  }
}

export function runReplay(level: LevelData, replay: Replay): Snapshot {
  const s = newGameState(level, replay.mode)
  let prev = NONE
  let trace = 2166136261 >>> 0

  for (const f of replay.frames) {
    const input = toInput(f, prev)
    const events = s.scene === 'playing' ? updateFrame(s, input, DT) : []
    advanceScene(s, events, DT)
    trace = hashStep(
      trace,
      s.player.x,
      s.player.y,
      s.player.vx,
      s.player.vy,
      POWER_CODE[s.player.power],
      s.score,
      s.deaths,
    )
    prev = f
  }
  return snapshot(s, replay.frames.length, trace)
}

/** 프레임 하나를 0~15 값으로 접어 문자 하나로 만든다 */
export function compress(frames: Frame[]): string {
  return frames
    .map((f) => (f.l | (f.r << 1) | (f.j << 2) | (f.f << 3)).toString(16))
    .join('')
}

export function expand(s: string): Frame[] {
  return [...s].map((c) => {
    const v = parseInt(c, 16)
    return {
      l: ((v >> 0) & 1) as 0 | 1,
      r: ((v >> 1) & 1) as 0 | 1,
      j: ((v >> 2) & 1) as 0 | 1,
      f: ((v >> 3) & 1) as 0 | 1,
    }
  })
}
