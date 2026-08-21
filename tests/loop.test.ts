import { describe, expect, it } from 'vitest'
import { createLoop } from '../src/core/loop'
import { DT } from '../src/engine/tuning'

function harness() {
  const dts: number[] = []
  let renders = 0
  const loop = createLoop({
    update: (dt) => {
      dts.push(dt)
    },
    render: () => {
      renders += 1
    },
  })
  return { loop, dts, renders: () => renders }
}

describe('createLoop', () => {
  it('첫 tick은 기준시각만 잡고 update를 부르지 않는다', () => {
    const h = harness()
    h.loop.tick(1000)
    expect(h.dts).toEqual([])
  })

  it('경과 시간을 고정 dt로 쪼개 update를 부른다', () => {
    const h = harness()
    h.loop.tick(0)
    h.loop.tick(51) // 51ms → 16.67ms 단위 3회 (잔여 1ms)
    expect(h.dts).toHaveLength(3)
    expect(h.dts.every((d) => d === DT)).toBe(true)
  })

  it('한 프레임 분량을 절대 초과해서 진행하지 않는다', () => {
    // 50ms는 수학적으로 정확히 3프레임이지만 16.666666666666668 * 3 이
    // 50을 넘으므로 2프레임만 돌아야 한다. 초과 진행은 물리를 앞당긴다.
    const h = harness()
    h.loop.tick(0)
    h.loop.tick(50)
    expect(h.dts).toHaveLength(2)
  })

  it('남은 시간은 누적되어 다음 tick으로 넘어간다', () => {
    const h = harness()
    h.loop.tick(0)
    h.loop.tick(10) // 10ms — 아직 한 프레임 미달
    expect(h.dts).toHaveLength(0)
    h.loop.tick(20) // 누적 20ms → 1회
    expect(h.dts).toHaveLength(1)
  })

  it('탭 복귀 등으로 긴 시간이 지나도 최대 5프레임만 캐치업한다', () => {
    const h = harness()
    h.loop.tick(0)
    h.loop.tick(60_000) // 1분
    expect(h.dts).toHaveLength(5)
  })

  it('캐치업 상한에 걸리면 누적자를 버려 다음 tick이 폭주하지 않는다', () => {
    const h = harness()
    h.loop.tick(0)
    h.loop.tick(60_000)
    h.dts.length = 0
    h.loop.tick(60_000 + 20)
    expect(h.dts).toHaveLength(1)
  })

  it('update 호출 여부와 무관하게 tick마다 render를 부른다', () => {
    const h = harness()
    h.loop.tick(0)
    h.loop.tick(5)
    expect(h.renders()).toBe(2)
  })

  it('reset 후에는 다시 기준시각을 잡는다', () => {
    const h = harness()
    h.loop.tick(0)
    h.loop.reset()
    h.loop.tick(10_000)
    expect(h.dts).toHaveLength(0)
  })
})
