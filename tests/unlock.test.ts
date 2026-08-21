import { describe, expect, it } from 'vitest'
import { clearedCount, furthestUnlocked, isUnlocked } from '../src/game/unlock'
import { cellRect, stageHitTest } from '../src/ui/stageSelect'
import { STAGES } from '../src/levels/index'
import type { BestRecord, Progress } from '../src/types'

const IDS = STAGES.map((s) => s.id)

const done: BestRecord = { cleared: true, bestScore: 100, bestTimeMs: 1000, fewestDeaths: 0 }
const tried: BestRecord = { cleared: false, bestScore: 0, bestTimeMs: 0, fewestDeaths: 0 }

function progressUpTo(n: number): Progress {
  const p: Progress = {}
  for (let i = 0; i < n; i++) p[IDS[i]!] = { ...done }
  return p
}

describe('isUnlocked', () => {
  it('1탄은 진행도가 없어도 열려 있다', () => {
    expect(isUnlocked(IDS, 0, {})).toBe(true)
  })

  it('2탄은 1탄을 깨야 열린다', () => {
    expect(isUnlocked(IDS, 1, {})).toBe(false)
    expect(isUnlocked(IDS, 1, progressUpTo(1))).toBe(true)
  })

  it('깨지 않고 시도만 한 것은 다음을 열지 않는다', () => {
    expect(isUnlocked(IDS, 1, { [IDS[0]!]: tried })).toBe(false)
  })

  it('중간을 건너뛴 진행도로는 열리지 않는다', () => {
    // 3탄만 깬 이상한 상태 — 2탄은 여전히 잠겨 있다
    expect(isUnlocked(IDS, 1, { [IDS[2]!]: done })).toBe(false)
  })

  it('마지막 탄까지 순서대로 열린다', () => {
    for (let i = 0; i < IDS.length; i++) {
      expect(isUnlocked(IDS, i, progressUpTo(i)), `${i}번째`).toBe(true)
    }
  })

  it('범위를 넘는 인덱스는 잠겨 있다', () => {
    expect(isUnlocked(IDS, IDS.length, progressUpTo(IDS.length))).toBe(false)
  })
})

describe('furthestUnlocked', () => {
  it('진행도가 없으면 0', () => {
    expect(furthestUnlocked(IDS, {})).toBe(0)
  })

  it('3탄까지 깼으면 4탄(인덱스 3)이 최전선', () => {
    expect(furthestUnlocked(IDS, progressUpTo(3))).toBe(3)
  })

  it('전부 깼으면 마지막 인덱스에서 멈춘다', () => {
    expect(furthestUnlocked(IDS, progressUpTo(10))).toBe(9)
  })
})

describe('clearedCount', () => {
  it('깬 개수를 센다', () => {
    expect(clearedCount(IDS, {})).toBe(0)
    expect(clearedCount(IDS, progressUpTo(7))).toBe(7)
  })

  it('시도만 한 것은 세지 않는다', () => {
    expect(clearedCount(IDS, { [IDS[0]!]: tried })).toBe(0)
  })
})

describe('스테이지 선택 히트테스트', () => {
  const center = (i: number) => {
    const r = cellRect(i)
    return [r.x + r.w / 2, r.y + r.h / 2] as const
  }

  it('10칸이 서로 겹치지 않는다', () => {
    for (let i = 0; i < 10; i++) {
      for (let j = i + 1; j < 10; j++) {
        const a = cellRect(i)
        const b = cellRect(j)
        const overlap =
          a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h
        expect(overlap, `${i}번과 ${j}번이 겹친다`).toBe(false)
      }
    }
  })

  it('열린 칸을 누르면 그 인덱스를 준다', () => {
    expect(stageHitTest(...center(0), STAGES, {})).toBe(0)
  })

  it('잠긴 칸을 누르면 null 이다', () => {
    expect(stageHitTest(...center(5), STAGES, {})).toBeNull()
  })

  it('진행도가 쌓이면 그만큼 눌린다', () => {
    const p = progressUpTo(5)
    expect(stageHitTest(...center(4), STAGES, p)).toBe(4)
    expect(stageHitTest(...center(5), STAGES, p)).toBe(5)
    expect(stageHitTest(...center(6), STAGES, p)).toBeNull()
  })

  it('칸 밖을 누르면 null', () => {
    expect(stageHitTest(2, 2, STAGES, progressUpTo(10))).toBeNull()
  })

  it('모든 칸이 화면 안에 있다', () => {
    for (let i = 0; i < 10; i++) {
      const r = cellRect(i)
      expect(r.x, `${i}번 왼쪽`).toBeGreaterThanOrEqual(0)
      expect(r.y, `${i}번 위`).toBeGreaterThanOrEqual(0)
      expect(r.x + r.w, `${i}번 오른쪽`).toBeLessThanOrEqual(416)
      expect(r.y + r.h, `${i}번 아래`).toBeLessThanOrEqual(192)
    }
  })
})
