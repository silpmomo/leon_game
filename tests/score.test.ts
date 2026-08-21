import { describe, expect, it } from 'vitest'
import { SCORE, flagBonus, stompScore, timeBonus } from '../src/game/score'

describe('stompScore', () => {
  it('연속 밟기마다 배로 오른다', () => {
    expect(stompScore(0)).toBe(100)
    expect(stompScore(1)).toBe(200)
    expect(stompScore(2)).toBe(400)
    expect(stompScore(3)).toBe(800)
  })

  it('사슬 끝을 넘으면 최대값에서 멈춘다', () => {
    expect(stompScore(4)).toBe(800)
    expect(stompScore(99)).toBe(800)
  })

  it('음수도 첫 단계로 취급한다', () => {
    expect(stompScore(-1)).toBe(100)
  })
})

describe('flagBonus', () => {
  it('깃대 맨 위를 잡으면 최대 보너스', () => {
    expect(flagBonus(64, 64, 160)).toBe(SCORE.flagMax)
  })

  it('맨 아래를 잡으면 0', () => {
    expect(flagBonus(160, 64, 160)).toBe(0)
  })

  it('중간은 절반 근처', () => {
    expect(flagBonus(112, 64, 160)).toBeCloseTo(SCORE.flagMax / 2, -1)
  })

  it('범위를 벗어난 입력도 0~최대 사이로 묶인다', () => {
    expect(flagBonus(0, 64, 160)).toBe(SCORE.flagMax)
    expect(flagBonus(999, 64, 160)).toBe(0)
  })

  it('깃대 길이가 0이면 최대 보너스를 준다 (0으로 나누지 않는다)', () => {
    expect(flagBonus(64, 64, 64)).toBe(SCORE.flagMax)
  })

  it('높이 순서가 점수 순서와 같다', () => {
    const high = flagBonus(70, 64, 160)
    const mid = flagBonus(112, 64, 160)
    const low = flagBonus(150, 64, 160)
    expect(high).toBeGreaterThan(mid)
    expect(mid).toBeGreaterThan(low)
  })
})

describe('timeBonus', () => {
  it('남은 초당 50점', () => {
    expect(timeBonus(10_000)).toBe(500)
  })

  it('초 단위로 버림한다', () => {
    expect(timeBonus(10_999)).toBe(500)
  })

  it('음수와 0은 0으로 취급한다', () => {
    expect(timeBonus(-1)).toBe(0)
    expect(timeBonus(0)).toBe(0)
  })
})
