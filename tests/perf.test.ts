import { describe, expect, it } from 'vitest'
import { createPerfWatch, pickScale } from '../src/perf'
import { VIEW_H, VIEW_W } from '../src/engine/tuning'

describe('pickScale', () => {
  it('논리 해상도가 딱 들어가면 1배', () => {
    expect(pickScale(VIEW_W, VIEW_H, false)).toBe(1)
  })

  it('2배가 들어가면 2배를 쓴다', () => {
    expect(pickScale(VIEW_W * 2, VIEW_H * 2, false)).toBe(2)
  })

  it('가로·세로 중 작은 쪽에 맞춘다', () => {
    expect(pickScale(VIEW_W * 3, VIEW_H * 2, false)).toBe(2)
    expect(pickScale(VIEW_W * 2, VIEW_H * 3, false)).toBe(2)
  })

  it('화면이 논리 해상도보다 작아도 1배 아래로 내려가지 않는다', () => {
    expect(pickScale(100, 100, false)).toBe(1)
  })

  it('정수 배율만 나온다', () => {
    for (const w of [500, 700, 844, 1000, 1200, 1920]) {
      expect(Number.isInteger(pickScale(w, w / 2, false))).toBe(true)
    }
  })

  it('아이폰 가로 844x390 에서는 2배', () => {
    expect(pickScale(844, 390, false)).toBe(2)
  })

  it('downgrade가 켜지면 한 단계 낮춘다', () => {
    expect(pickScale(VIEW_W * 3, VIEW_H * 3, true)).toBe(2)
    expect(pickScale(VIEW_W, VIEW_H, true)).toBe(1) // 1배 아래로는 안 내려간다
  })
})

describe('createPerfWatch', () => {
  it('빠른 프레임에서는 배율 하향을 요구하지 않는다', () => {
    const w = createPerfWatch()
    let asked = false
    for (let i = 0; i < 400; i++) if (w.sample(16)) asked = true
    expect(asked).toBe(false)
  })

  it('창이 채워지기 전에는 판단하지 않는다', () => {
    const w = createPerfWatch()
    let asked = false
    for (let i = 0; i < 100; i++) if (w.sample(100)) asked = true
    expect(asked).toBe(false)
  })

  it('느린 프레임이 계속되면 배율 하향을 요구한다', () => {
    const w = createPerfWatch()
    let asked = false
    for (let i = 0; i < 200; i++) if (w.sample(40)) asked = true
    expect(asked).toBe(true)
  })

  it('한 번만 요구한다 (계속 내려가지 않는다)', () => {
    const w = createPerfWatch()
    let count = 0
    for (let i = 0; i < 600; i++) if (w.sample(40)) count += 1
    expect(count).toBe(1)
  })

  it('간헐적인 스파이크로는 내려가지 않는다', () => {
    const w = createPerfWatch()
    let asked = false
    for (let i = 0; i < 600; i++) if (w.sample(i % 20 === 0 ? 60 : 16)) asked = true
    expect(asked).toBe(false)
  })

  it('경계(절반이 느림)에서는 하향을 요구한다', () => {
    const w = createPerfWatch()
    let asked = false
    for (let i = 0; i < 240; i++) if (w.sample(i % 2 === 0 ? 40 : 16)) asked = true
    expect(asked).toBe(true)
  })
})
