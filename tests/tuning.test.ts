import { describe, expect, it } from 'vitest'
import { TILE, TUNING, derive } from '../src/engine/tuning'

describe('derive', () => {
  const d = derive()

  it('최고 점프 높이는 약 73px (4.6타일)', () => {
    expect(d.jumpHeight).toBeCloseTo(73.1, 1)
    expect(d.jumpHeight / TILE).toBeGreaterThan(4.5)
    expect(d.jumpHeight / TILE).toBeLessThan(4.7)
  })

  it('체공 시간은 약 780ms', () => {
    expect(d.riseMs).toBeCloseTo(457, 0)
    expect(d.fallMs).toBeCloseTo(323, 0)
    expect(d.airTimeMs).toBeCloseTo(780, 0)
  })

  it('걷기 점프는 4타일을 넘고 5타일에는 못 미친다', () => {
    const tiles = d.walkReach / TILE
    expect(tiles).toBeGreaterThan(4)
    expect(tiles).toBeLessThan(5)
  })

  it('달리기 점프는 7타일을 넘는다', () => {
    expect(d.runReach / TILE).toBeGreaterThan(7)
  })

  it('D구간 설계 근거: 3타일은 걷기로 넘고 5타일은 못 넘는다', () => {
    expect(d.walkReach).toBeGreaterThan(3 * TILE)
    expect(d.walkReach).toBeLessThan(5 * TILE)
    expect(d.runReach).toBeGreaterThan(5 * TILE)
  })

  it('최대 낙하속도는 한 프레임 이동량이 타일보다 작도록 제한된다 (터널링 방지)', () => {
    expect(TUNING.maxFall * (1 / 60)).toBeLessThan(TILE)
  })
})
