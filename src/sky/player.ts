import type { Option, Shot, SkyPlayer } from './types'
import {
  BOUND, MISSILE_DMG, MISSILE_EVERY, MISSILE_SPEED, OPTION_COOL, OPTION_DMG,
  OPTION_FOLLOW, PLAYER, SHOT_LEVELS, SHOT_SPEED,
} from './tuning'

/** 한 프레임 분 조작. 화면·이벤트를 모르는 순수 입력 */
export type SkyInput = {
  /** 드래그로 지정된 목표 위치. 없으면 null */
  tx: number | null
  ty: number | null
  /** 키보드 축 (-1..1) */
  ax: number
  ay: number
  /** 이번 프레임에 궁극기 버튼이 눌렸는가 (엣지) */
  bomb: boolean
}

export const NO_INPUT: SkyInput = { tx: null, ty: null, ax: 0, ay: 0, bomb: false }

export function newPlayer(): SkyPlayer {
  return {
    x: 70,
    y: BOUND.y0 + (BOUND.y1 - BOUND.y0) / 2,
    power: 0,
    bombs: PLAYER.startBombs,
    invMs: PLAYER.respawnInvMs,
    stunMs: 0,
    cool: 0,
    shotN: 0,
    tilt: 0,
    alive: true,
  }
}

function clamp(v: number, a: number, b: number): number {
  return v < a ? a : v > b ? b : v
}

/** 파워 단계에 맞는 옵션 배열을 만든다. 개수가 바뀔 때만 새로 만든다 */
export function syncOptions(p: SkyPlayer, options: Option[]): Option[] {
  const want = SHOT_LEVELS[p.power]!.options
  if (options.length === want) return options
  const out: Option[] = []
  for (let i = 0; i < want; i++) {
    const prev = options[i]
    out.push(
      prev ?? { x: p.x - 12, y: p.y, oy: i === 0 ? -12 : 12, cool: OPTION_COOL / 2 },
    )
    // 개수가 바뀌면 위아래 자리를 다시 잡는다
    out[i]!.oy = want === 1 ? -13 : i === 0 ? -13 : 13
  }
  return out
}

/** 이동 한 프레임 */
export function movePlayer(p: SkyPlayer, input: SkyInput, dt: number): void {
  const ms = dt * 1000
  if (p.invMs > 0) p.invMs = Math.max(0, p.invMs - ms)
  if (p.stunMs > 0) p.stunMs = Math.max(0, p.stunMs - ms)

  const slow = p.stunMs > 0 ? PLAYER.stunSlow : 1
  const beforeY = p.y

  if (input.tx !== null && input.ty !== null) {
    // 손가락을 따라간다. 그대로 대입하지 않고 살짝 당기면 떨림이 없어진다
    const k = Math.min(1, 30 * dt) * slow
    p.x += (input.tx - p.x) * k
    p.y += (input.ty - p.y) * k
  } else {
    p.x += input.ax * PLAYER.keySpeed * slow * dt
    p.y += input.ay * PLAYER.keySpeed * slow * dt
  }

  p.x = clamp(p.x, BOUND.x0, BOUND.x1)
  p.y = clamp(p.y, BOUND.y0, BOUND.y1)

  // 기울기는 그림에만 쓴다. 급하게 움직일수록 크게 눕는다
  const dy = (p.y - beforeY) / Math.max(dt, 1e-6)
  p.tilt += (clamp(dy / 190, -1, 1) - p.tilt) * Math.min(1, 12 * dt)
}

/**
 * 자동 발사. 쏜 탄을 shots 에 넣고, 쐈으면 true.
 *
 * 텐가이의 사역마(옵션)를 그대로 옮겼다 — 파워가 오르면 옵션이 늘고
 * 최대 단계에서는 유도 미사일이 붙는다.
 */
export function autoFire(
  p: SkyPlayer,
  options: Option[],
  shots: Shot[],
  dt: number,
): boolean {
  const ms = dt * 1000
  const lv = SHOT_LEVELS[p.power]!
  let fired = false

  p.cool -= ms
  if (p.cool <= 0) {
    p.cool += lv.cool
    p.shotN += 1
    fired = true

    for (let i = 0; i < lv.ways; i++) {
      const t = lv.ways === 1 ? 0 : i / (lv.ways - 1) - 0.5
      const a = t * lv.spread * 2
      shots.push({
        x: p.x + 8,
        y: p.y + (lv.spread === 0 ? t * 8 : 0),
        vx: Math.cos(a) * SHOT_SPEED,
        vy: Math.sin(a) * SHOT_SPEED,
        dmg: lv.dmg,
        homing: false,
        age: 0,
        r: 3,
      })
    }

    // 매 발마다 미사일을 내면 초당 13발이 화면을 덮는다. 넷에 한 발만
    if (lv.missiles > 0 && p.shotN % MISSILE_EVERY === 0) {
      // 위아래로 번갈아 나간다. 두 발을 한 번에 쏘면 화면이 지저분해진다
      const up = (p.shotN / MISSILE_EVERY) % 2 === 0
      shots.push({
        x: p.x,
        y: p.y + (up ? -6 : 6),
        vx: MISSILE_SPEED * 0.5,
        vy: (up ? -1 : 1) * MISSILE_SPEED * 0.7,
        dmg: MISSILE_DMG,
        homing: true,
        age: 0,
        r: 4,
      })
    }
  }

  for (const o of options) {
    o.cool -= ms
    if (o.cool > 0) continue
    o.cool += OPTION_COOL
    shots.push({
      x: o.x + 6,
      y: o.y,
      vx: SHOT_SPEED * 0.92,
      vy: 0,
      dmg: OPTION_DMG,
      homing: false,
      age: 0,
      r: 2.5,
    })
  }

  return fired
}

/** 옵션이 본체를 늦게 따라온다 */
export function moveOptions(p: SkyPlayer, options: Option[], dt: number): void {
  const k = Math.min(1, OPTION_FOLLOW * 60 * dt)
  for (const o of options) {
    o.x += (p.x - 10 - o.x) * k
    o.y += (p.y + o.oy - o.y) * k
  }
}

/** 파워업 한 칸. 이미 최대면 false */
export function powerUp(p: SkyPlayer): boolean {
  if (p.power >= PLAYER.maxPower) return false
  p.power += 1
  return true
}

/**
 * 적과 부딪혔을 때. 텐가이와 같이 죽지 않고 파워 한 단계만 잃는다.
 * 아이에게 딱 맞는 규칙이라 그대로 가져왔다.
 */
export function bump(p: SkyPlayer): void {
  if (p.invMs > 0 || p.stunMs > 0) return
  p.power = Math.max(0, p.power - 1)
  p.stunMs = PLAYER.stunMs
}

/** 궁극기를 쓸 수 있으면 쓰고 true */
export function useBomb(p: SkyPlayer): boolean {
  if (p.bombs <= 0 || !p.alive) return false
  p.bombs -= 1
  p.invMs = Math.max(p.invMs, PLAYER.bombInvMs)
  return true
}

/** 궁극기 하나 추가. 이미 가득이면 false (점수 보너스로 바뀐다) */
export function addBomb(p: SkyPlayer): boolean {
  if (p.bombs >= PLAYER.maxBombs) return false
  p.bombs += 1
  return true
}
