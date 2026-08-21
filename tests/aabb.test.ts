import { describe, expect, it } from 'vitest'
import { overlapX, overlapY, overlaps } from '../src/engine/aabb'

const r = (x: number, y: number, w: number, h: number) => ({ x, y, w, h })

describe('overlaps', () => {
  it('겹치면 true', () => {
    expect(overlaps(r(0, 0, 10, 10), r(5, 5, 10, 10))).toBe(true)
  })

  it('정확히 맞닿기만 하면 false (경계 공유는 겹침이 아니다)', () => {
    expect(overlaps(r(0, 0, 10, 10), r(10, 0, 10, 10))).toBe(false)
    expect(overlaps(r(0, 0, 10, 10), r(0, 10, 10, 10))).toBe(false)
  })

  it('폭이 0이면 어떤 것과도 겹치지 않는다', () => {
    expect(overlaps(r(5, 5, 0, 10), r(0, 0, 10, 10))).toBe(false)
  })

  it('한 축만 겹쳐도 false', () => {
    expect(overlaps(r(0, 0, 10, 10), r(5, 20, 10, 10))).toBe(false)
  })
})

describe('overlapX / overlapY', () => {
  it('겹침량을 반환한다', () => {
    expect(overlapX(r(0, 0, 10, 10), r(6, 0, 10, 10))).toBe(4)
    expect(overlapY(r(0, 0, 10, 10), r(0, 7, 10, 10))).toBe(3)
  })

  it('떨어져 있으면 0 이하', () => {
    expect(overlapX(r(0, 0, 10, 10), r(12, 0, 10, 10))).toBeLessThanOrEqual(0)
  })
})
