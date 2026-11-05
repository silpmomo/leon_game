import type {
  ArenaEvent, ArenaInput, ArenaMap, ArenaMode, ArenaState, BotDifficulty, Skin,
} from './types'
import { parseMap } from './grid'
import { makeRng } from '../sky/rng'
import {
  aliveCount, autoAim, fire, fireSuper, makeFighter, moveFighter,
  pickGems, tickBursts, tickFighter, updateBullets,
} from './combat'
import { botIntent, newBrain } from './ai'
import { COUNTDOWN_MS, GAS_DELAY_S } from './tuning'

/** 봇 명단. 대모험에 나오는 친구들이 숲에 모였다 */
export const ROSTER: readonly { name: string; skin: Skin }[] = [
  { name: '브로콜리', skin: 'broccoli' },
  { name: '악어', skin: 'crocodile' },
  { name: '수프', skin: 'soup' },
  { name: '밤송이', skin: 'spiky' },
  { name: '파닥이', skin: 'flyer' },
  { name: '던지미', skin: 'thrower' },
  { name: '꼬마브로콜리', skin: 'broccoli' },
]

/**
 * 시작점 고르기. 리온 자리는 seed 로 정하고, 봇은 이미 고른 자리에서
 * 가장 먼 곳부터 채운다 — 봇이 적은 판에서 둘이 붙어 시작하지 않는다.
 */
export function pickSpawns(
  spawns: readonly [number, number][], count: number, first: number,
): [number, number][] {
  const chosen: [number, number][] = [spawns[first % spawns.length]!]
  const left = spawns.filter((_, i) => i !== first % spawns.length)
  while (chosen.length < count && left.length > 0) {
    let bi = 0
    let bd = -1
    for (let i = 0; i < left.length; i++) {
      const [x, y] = left[i]!
      const d = Math.min(...chosen.map(([cx, cy]) => Math.hypot(cx - x, cy - y)))
      if (d > bd) {
        bd = d
        bi = i
      }
    }
    chosen.push(left.splice(bi, 1)[0]!)
  }
  return chosen
}

export function newArenaState(map: ArenaMap, mode: ArenaMode, seed = 7): ArenaState {
  const { grid, spawns } = parseMap(map)
  const rng = makeRng(seed)
  const first = Math.floor(rng.f() * spawns.length)
  const at = pickSpawns(spawns, map.bots + 1, first)

  const fighters = [makeFighter(0, '리온', 'leon', 'bolt', true, at[0]![0], at[0]![1])]
  for (let i = 0; i < map.bots; i++) {
    const r = ROSTER[i % ROSTER.length]!
    const w = map.weapons[i % map.weapons.length]!
    const [x, y] = at[i + 1]!
    const f = makeFighter(i + 1, r.name, r.skin, w, false, x, y)
    f.brain = newBrain()
    // 첫 판단이 모두 같은 프레임에 몰리지 않게 흩는다
    f.brain.thinkMs = rng.f() * map.difficulty.thinkMs
    fighters.push(f)
  }

  return {
    map, grid, spawns, mode,
    scene: 'countdown',
    sceneMs: COUNTDOWN_MS,
    t: 0,
    seed: rng.seed,
    fighters,
    bullets: [],
    gems: [],
    bursts: [],
    score: 0,
    nextRank: fighters.length,
    muted: false,
    gasAnnounced: false,
  }
}

export type UpdateOpts = {
  /** 리온도 봇 두뇌로 움직인다 (테스트 · 밸런스 측정) */
  autopilot?: boolean
}

/**
 * 봇 리온의 두뇌. 진짜 리온은 자동 조준이라 오차가 없다 —
 * 봇과 같은 오차를 주면 밸런스를 실제보다 어렵게 잰다.
 */
export const AUTOPILOT: BotDifficulty = { aimError: 0, thinkMs: 300, aggro: 110, fleeAt: 0.35 }

/** playing 한 프레임. 씬 전이는 scenes.ts 가 한다 */
export function updateArena(
  s: ArenaState, input: ArenaInput, dt: number, opts: UpdateOpts = {},
): ArenaEvent[] {
  const events: ArenaEvent[] = []
  if (s.scene !== 'playing') return events
  s.t += dt
  if (!s.gasAnnounced && s.t >= GAS_DELAY_S) {
    s.gasAnnounced = true
    events.push('gasStart')
  }

  const rng = makeRng(s.seed)
  const d = s.map.difficulty

  for (const f of s.fighters) {
    if (!f.alive) continue
    if (f.isPlayer && !opts.autopilot) {
      moveFighter(s, f, input.mx, input.my, dt)
      if (input.superPressed) fireSuper(s, f, events)
      if (input.fire) {
        const aim = autoAim(s, f)
        fire(s, f, aim.dx, aim.dy, events)
      }
      continue
    }
    const it = botIntent(s, f, dt, f.isPlayer ? AUTOPILOT : d, rng)
    moveFighter(s, f, it.mx, it.my, dt)
    if (it.super) fireSuper(s, f, events)
    else if (it.aim) fire(s, f, it.aim[0], it.aim[1], events)
  }

  updateBullets(s, dt, events)
  for (const f of s.fighters) tickFighter(s, f, dt, events)
  pickGems(s, events)
  tickBursts(s, dt)
  s.seed = rng.seed

  const player = s.fighters[0]!
  if (player.alive && aliveCount(s) === 1) {
    player.rank = 1
    events.push('win')
  }
  return events
}

export function player(s: ArenaState) {
  return s.fighters[0]!
}
