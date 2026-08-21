import { VIEW_H, VIEW_W } from './engine/tuning'

export function pickScale(w: number, h: number, downgrade: boolean): number {
  const fit = Math.min(Math.floor(w / VIEW_W), Math.floor(h / VIEW_H))
  const base = Math.max(1, fit)
  return downgrade ? Math.max(1, base - 1) : base
}

export type PerfWatch = { sample: (dtMs: number) => boolean }

const SLOW_MS = 24 // 약 41fps 아래
const WINDOW = 120 // 최근 프레임 수
const SLOW_RATIO = 0.5 // 절반 이상이 느리면 하향

export function createPerfWatch(): PerfWatch {
  const recent: boolean[] = []
  let asked = false

  return {
    sample(dtMs: number): boolean {
      recent.push(dtMs > SLOW_MS)
      if (recent.length > WINDOW) recent.shift()
      if (asked || recent.length < WINDOW) return false

      const slow = recent.reduce((n, s) => n + (s ? 1 : 0), 0)
      if (slow / WINDOW >= SLOW_RATIO) {
        asked = true
        return true
      }
      return false
    },
  }
}
