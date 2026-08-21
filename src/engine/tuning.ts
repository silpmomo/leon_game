export const TILE = 16
export const VIEW_W = 416
export const VIEW_H = 192
export const DT = 1 / 60
export const MAX_CATCHUP_FRAMES = 5

export const TUNING = {
  walkMax: 90, // px/s
  runMax: 150, // px/s
  runRampMs: 1200, // 방향 버튼 유지 → runMax 도달까지
  accel: 300, // px/s^2
  decel: 450, // px/s^2
  skidDecel: 900, // px/s^2
  airAccel: 200, // px/s^2
  jumpVel: -320, // px/s
  gravityRise: 700, // px/s^2 (버튼 유지 중 상승)
  gravityFall: 1400, // px/s^2
  maxFall: 400, // px/s
  coyoteMs: 80,
  jumpBufferMs: 120,
  cornerNudge: 3, // px
  stompBounce: -180, // px/s
  stompBounceHeld: -280, // px/s
  stompGrace: 4, // px — 밟기 판정 여유
  invulnMs: 1500,
  deathFallMargin: 32, // px — 레벨 바닥 아래 이 거리를 넘으면 낙하사
} as const

export type Tuning = typeof TUNING

export type Derived = {
  jumpHeight: number
  riseMs: number
  fallMs: number
  airTimeMs: number
  walkReach: number
  runReach: number
}

/**
 * 상수에서 파생되는 값. 레벨 검증(스펙 §6.3 규칙 4)이 이 함수를 그대로 쓴다.
 * 상수를 바꾸면 통과 가능한 구덩이 폭도 함께 바뀐다.
 */
export function derive(t: Tuning = TUNING): Derived {
  const v = Math.abs(t.jumpVel)
  const jumpHeight = (v * v) / (2 * t.gravityRise)
  const riseMs = (v / t.gravityRise) * 1000
  const fallMs = Math.sqrt((2 * jumpHeight) / t.gravityFall) * 1000
  const airTimeMs = riseMs + fallMs
  const airTimeS = airTimeMs / 1000
  return {
    jumpHeight,
    riseMs,
    fallMs,
    airTimeMs,
    walkReach: t.walkMax * airTimeS,
    runReach: t.runMax * airTimeS,
  }
}
