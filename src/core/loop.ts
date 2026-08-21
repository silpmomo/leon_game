import { DT, MAX_CATCHUP_FRAMES } from '../engine/tuning'

export type LoopOpts = {
  update: (dt: number) => void
  render: () => void
}

export type Loop = {
  /** t: 밀리초 타임스탬프. 시각을 주입받으므로 rAF 없이 테스트된다. */
  tick: (t: number) => void
  reset: () => void
  start: () => void
  stop: () => void
}

export function createLoop({ update, render }: LoopOpts): Loop {
  const stepMs = DT * 1000
  let last: number | null = null
  let acc = 0
  let raf = 0

  function tick(t: number): void {
    if (last === null) {
      last = t
      render()
      return
    }
    acc += t - last
    last = t

    let frames = 0
    while (acc >= stepMs) {
      if (frames >= MAX_CATCHUP_FRAMES) {
        acc = 0 // 상한 초과분은 버린다 — 다음 tick 폭주 방지
        break
      }
      update(DT)
      acc -= stepMs
      frames += 1
    }
    render()
  }

  function reset(): void {
    last = null
    acc = 0
  }

  function frame(t: number): void {
    tick(t)
    raf = requestAnimationFrame(frame)
  }

  return {
    tick,
    reset,
    start: () => {
      raf = requestAnimationFrame(frame)
    },
    stop: () => {
      cancelAnimationFrame(raf)
    },
  }
}
