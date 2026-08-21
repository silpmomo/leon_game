export const SCORE = {
  coin: 200,
  stompChain: [100, 200, 400, 800],
  flagMax: 5000,
  timeBonusPerSec: 50,
  coinsPerLife: 100,
  bossKill: 5000,
} as const

export function stompScore(combo: number): number {
  const chain = SCORE.stompChain
  const i = Math.min(Math.max(0, combo), chain.length - 1)
  return chain[i]!
}

/** 깃대를 잡은 y가 위쪽일수록 높은 보너스. y는 화면 좌표(작을수록 위). */
export function flagBonus(grabY: number, flagTopY: number, flagBottomY: number): number {
  const span = flagBottomY - flagTopY
  if (span <= 0) return SCORE.flagMax
  const t = (flagBottomY - grabY) / span
  const clamped = Math.max(0, Math.min(1, t))
  return Math.round(clamped * SCORE.flagMax)
}

export function timeBonus(remainingMs: number): number {
  if (remainingMs <= 0) return 0
  return Math.floor(remainingMs / 1000) * SCORE.timeBonusPerSec
}
