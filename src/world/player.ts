import type { InputState, Player, PowerState, TileGrid } from '../types'
import { TILE, TUNING } from '../engine/tuning'
import { applyGravity, moveX, moveY, type VerticalHit } from '../engine/physics'

export const PLAYER_SIZE = {
  small: { w: 11, h: 21 },
  big: { w: 13, h: 29 },
} as const

function sizeFor(power: PowerState): { w: number; h: number } {
  return power === 'small' ? PLAYER_SIZE.small : PLAYER_SIZE.big
}

/** tx,ty 타일 위에 서 있는 상태로 만든다 (발밑 = ty 타일의 아래 경계) */
export function createPlayer(tx: number, ty: number): Player {
  const { w, h } = PLAYER_SIZE.small
  return {
    x: tx * TILE + (TILE - w) / 2,
    y: (ty + 1) * TILE - h,
    vx: 0,
    vy: 0,
    w,
    h,
    onGround: false,
    power: 'small',
    facing: 1,
    invulnMs: 0,
    coyoteMs: 0,
    jumpBufferMs: 0,
    rising: false,
    runMs: 0,
    skidding: false,
    sliding: false,
  }
}

/** 발밑과 가로 중심을 유지하며 크기를 바꾼다 */
export function resizePlayer(p: Player, power: PowerState): void {
  const feet = p.y + p.h
  const centerX = p.x + p.w / 2
  const { w, h } = sizeFor(power)
  p.power = power
  p.w = w
  p.h = h
  p.y = feet - h
  p.x = centerX - w / 2
}

export function maxSpeedFor(p: Player): number {
  const t = Math.min(1, p.runMs / TUNING.runRampMs)
  return TUNING.walkMax + (TUNING.runMax - TUNING.walkMax) * t
}

export type PlayerStep = {
  vertical: VerticalHit
  jumped: boolean
  landed: boolean
}

export function updatePlayer(
  p: Player,
  input: InputState,
  grid: TileGrid,
  dt: number,
): PlayerStep {
  const ms = dt * 1000

  // ── 방향 입력. 좌우 동시는 입력 계층에서 이미 하나로 줄여 오므로
  //    여기 둘 다 켜져 있으면 정지로 취급한다.
  const dir = (input.right ? 1 : 0) + (input.left ? -1 : 0)

  if (dir !== 0) {
    p.facing = dir as 1 | -1
    p.runMs += ms
  } else {
    p.runMs = 0
  }

  // ── 가로 가속·감속
  const max = maxSpeedFor(p)
  const turning = dir !== 0 && p.vx !== 0 && Math.sign(p.vx) !== dir
  p.skidding = p.onGround && turning

  if (dir === 0) {
    const dec = TUNING.decel * dt
    p.vx = Math.abs(p.vx) <= dec ? 0 : p.vx - Math.sign(p.vx) * dec
  } else {
    const a = !p.onGround ? TUNING.airAccel : turning ? TUNING.skidDecel : TUNING.accel
    p.vx += dir * a * dt
    p.vx = Math.max(-max, Math.min(max, p.vx))
  }

  // ── 코요테 타임 · 점프 버퍼 타이머
  p.coyoteMs = p.onGround ? TUNING.coyoteMs : Math.max(0, p.coyoteMs - ms)
  if (input.jumpPressed) p.jumpBufferMs = TUNING.jumpBufferMs
  else p.jumpBufferMs = Math.max(0, p.jumpBufferMs - ms)

  // ── 가변 점프: 버튼을 떼는 순간 남은 상승 속도를 잘라낸다.
  //    중력만 바꾸면 최소 점프가 2.3타일에서 멈춰 톡 치는 점프가 안 만들어진다.
  if (p.rising && !input.jump) {
    if (p.vy < 0) p.vy *= TUNING.jumpCut
    p.rising = false
  } else if (p.rising && p.vy >= 0) {
    p.rising = false
  }

  // ── 중력을 점프보다 먼저 적용한다.
  //    순서를 뒤집으면 점프 첫 프레임에 중력이 곧바로 깎여
  //    최고 높이가 derive()의 계산값보다 눈에 띄게 낮아진다.
  applyGravity(p, dt, p.rising)

  let jumped = false
  if (p.jumpBufferMs > 0 && p.coyoteMs > 0) {
    p.vy = TUNING.jumpVel
    p.rising = true
    p.onGround = false
    p.jumpBufferMs = 0
    p.coyoteMs = 0
    jumped = true
  }

  // ── 이동
  moveX(p, grid, dt)
  const wasAirborne = !p.onGround
  const vertical = moveY(p, grid, dt, true)
  const landed = wasAirborne && vertical.hit === 'ground'

  if (vertical.hit === 'ceiling') p.rising = false
  if (p.invulnMs > 0) p.invulnMs = Math.max(0, p.invulnMs - ms)

  return { vertical, jumped, landed }
}
