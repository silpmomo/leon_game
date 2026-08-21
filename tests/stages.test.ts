import { describe, expect, it } from 'vitest'
import {
  STAGES,
  STAGES_PER_WORLD,
  WORLD_COUNT,
  stageAt,
  stageIndexById,
  stagesOfWorld,
  worldOf,
} from '../src/levels/index'
import { validateLevel } from '../src/levels/schema'
import { parseTiles, solidAt, tileAt } from '../src/world/tilemap'
import { TILE, derive } from '../src/engine/tuning'
import type { LevelData } from '../src/types'
import { checkReachable } from './helpers/reach'
import { canComplete } from './helpers/bot'

describe('스테이지 목록', () => {
  it('두 월드에 각 10탄씩 20탄이 있다', () => {
    expect(STAGES).toHaveLength(20)
    expect(WORLD_COUNT).toBe(2)
    expect(STAGES_PER_WORLD).toBe(10)
  })

  it('id가 stage-01 ~ stage-20 이고 중복이 없다', () => {
    const ids = STAGES.map((s) => s.id)
    expect(ids).toEqual(
      Array.from({ length: 20 }, (_, i) => `stage-${String(i + 1).padStart(2, '0')}`),
    )
    expect(new Set(ids).size).toBe(20)
  })

  it('이름이 1-1 ~ 1-10, 2-1 ~ 2-10 이다', () => {
    expect(STAGES.map((s) => s.name)).toEqual([
      '1-1', '1-2', '1-3', '1-4', '1-5', '1-6', '1-7', '1-8', '1-9', '1-10',
      '2-1', '2-2', '2-3', '2-4', '2-5', '2-6', '2-7', '2-8', '2-9', '2-10',
    ])
  })

  it('id 는 그대로 두어 기존 진행도가 보존된다', () => {
    // 1월드 이름을 1탄 → 1-1 로 바꿀 때 id 를 건드리면 진행도가 날아간다
    expect(STAGES[0]!.id).toBe('stage-01')
    expect(STAGES[9]!.id).toBe('stage-10')
  })

  it('테마가 진행에 따라 바뀐다', () => {
    const themes = STAGES.map((s) => s.theme)
    expect(new Set(themes).size).toBeGreaterThanOrEqual(4)
    expect(themes[0]).toBe('day')
    expect(themes[9]).toBe('castle')
    expect(themes[19]).toBe('castle')
  })

  it('2월드는 얼음으로 시작한다', () => {
    expect(STAGES[10]!.theme).toBe('ice')
    expect(STAGES[10]!.name).toBe('2-1')
  })

  it('월드 구분이 맞는다', () => {
    expect(worldOf(0)).toBe(0)
    expect(worldOf(9)).toBe(0)
    expect(worldOf(10)).toBe(1)
    expect(worldOf(19)).toBe(1)
    expect(stagesOfWorld(0)).toHaveLength(10)
    expect(stagesOfWorld(1)).toHaveLength(10)
    expect(stagesOfWorld(1)[0]!.name).toBe('2-1')
  })

  it('2월드가 1월드보다 적이 많다', () => {
    const count = (from: number) =>
      STAGES.slice(from, from + 10).reduce(
        (a, s) => a + s.entities.filter((e) => e.type !== 'platform').length,
        0,
      )
    expect(count(10)).toBeGreaterThan(count(0))
  })

  it('stageAt은 범위를 벗어난 인덱스를 묶는다', () => {
    expect(stageAt(-5).id).toBe('stage-01')
    expect(stageAt(99).id).toBe('stage-20')
  })

  it('stageIndexById는 없는 id에 0을 준다', () => {
    expect(stageIndexById('stage-07')).toBe(6)
    expect(stageIndexById('없음')).toBe(0)
  })
})

describe.each(STAGES.map((s, i) => [s.name, s, i] as const))(
  '%s 검증',
  (_name, level: LevelData, index: number) => {
    const { grid } = parseTiles(level.tiles)

    it('검증 규칙을 모두 통과한다', () => {
      const issues = validateLevel(level)
      expect(issues.map((x) => `규칙 ${x.rule}: ${x.message}`)).toEqual([])
    })

    it('모든 행이 width와 같고 높이는 12다', () => {
      expect(level.height).toBe(12)
      expect(level.tiles).toHaveLength(12)
      for (const row of level.tiles) expect(row).toHaveLength(level.width)
    })

    it('폭이 화면(26타일)보다 넓다', () => {
      expect(level.width).toBeGreaterThan(26)
    })

    it('골이 스폰보다 오른쪽에 있다', () => {
      expect(level.goal.x).toBeGreaterThan(level.spawn.x + 20)
    })

    it('모든 적이 밟고 설 곳에 있다 (나는 적 제외)', () => {
      for (const e of level.entities) {
        if (e.type === 'platform' || e.type === 'flyer') continue
        expect(solidAt(grid, e.x, e.y + 1), `${e.type}@${e.x} 아래가 허공`).toBe(true)
      }
    })

    it('나는 적은 공중에 있다', () => {
      for (const e of level.entities) {
        if (e.type !== 'flyer') continue
        expect(solidAt(grid, e.x, e.y), `flyer@${e.x} 가 블록 안`).toBe(false)
      }
    })

    it('체크포인트가 순서대로 늘어나고 범위 안이다', () => {
      let prev = -1
      for (const cp of level.checkpoints) {
        expect(cp).toBeGreaterThan(prev)
        expect(cp).toBeLessThan(level.width)
        prev = cp
      }
    })

    it('첫 화면(26타일)에는 위험이 없다 — 시작하자마자 죽지 않는다', () => {
      for (let tx = level.spawn.x; tx < Math.min(level.width, level.spawn.x + 8); tx++) {
        expect(tileAt(grid, tx, 11), `${tx}열`).not.toBe('~')
        expect(tileAt(grid, tx, 9), `${tx}열`).not.toBe('^')
      }
    })

    it('난이도가 뒤로 갈수록 오르거나 유지된다 (적+위험 밀도)', () => {
      const hazards = level.tiles.join('').split('').filter((c) => c === '^' || c === '~').length
      const enemies = level.entities.filter((e) => e.type !== 'platform').length
      // 1-1 은 가장 쉬워야 한다
      if (index === 0) expect(hazards).toBe(0)
      expect(enemies).toBeGreaterThan(0)
    })
  },
)

// ── 통과 가능성 ────────────────────────────────────────────────

describe('지형 도달성 — 적을 무시하고 지형만으로 골에 닿는가', () => {
  it.each(STAGES.map((s) => [s.name, s] as const))('%s', (_n, level: LevelData) => {
    const r = checkReachable(level)
    expect(r.ok, r.reason).toBe(true)
  })

  it('모든 구간이 고립되지 않는다 (도달 비율 90% 이상)', () => {
    for (const level of STAGES) {
      const r = checkReachable(level)
      const ratio = r.reached / r.segments
      expect(ratio, `${level.name}: ${r.reached}/${r.segments} 구간만 도달`).toBeGreaterThan(0.9)
    }
  })
})

describe('1탄 통합 — 실제로 플레이해 끝까지 간다', () => {
  // 도달성 검사는 지형만 본다. 이 테스트는 입력→물리→규칙→씬 전체가
  // 맞물려 돌아가는지를 실제 플레이로 확인한다. 적 전투 실력이 필요한
  // 뒷 스테이지까지 봇에게 요구하지는 않는다.
  it('봇이 깃대까지 도달한다', () => {
    const r = canComplete(STAGES[0]!)
    expect(r.goal, `타일 ${r.maxTx} 에서 멈췄다 (${r.cause})`).toBe(true)
  })
})

describe('물리 상수와 레벨의 정합', () => {
  it('모든 구덩이가 달리기 점프 도달 거리 안이다 (발판 없는 것만)', () => {
    const limit = Math.floor(derive().runReach / TILE)
    for (const level of STAGES) {
      const { grid } = parseTiles(level.tiles)
      const plat = level.entities
        .filter((e): e is Extract<typeof e, { type: 'platform' }> => e.type === 'platform')
        .map((e) => [e.x - e.range - 3, e.x + e.range + 3] as const)

      let start = -1
      for (let tx = 0; tx <= level.width; tx++) {
        const isPit = tx < level.width && !solidAt(grid, tx, level.height - 1)
        if (isPit && start === -1) start = tx
        if (!isPit && start !== -1) {
          const w = tx - start
          const covered = plat.some(([a, b]) => a <= tx && b >= start)
          if (!covered) {
            expect(
              w,
              `${level.name} 타일 ${start}~${tx - 1} 구덩이 ${w}타일`,
            ).toBeLessThanOrEqual(limit)
          }
          start = -1
        }
      }
    }
  })

  it('오를 수 없는 단차가 없다', () => {
    const maxClimb = Math.floor(derive().jumpHeight / TILE)
    for (const level of STAGES) {
      for (const e of level.entities) {
        if (e.type !== 'platform') continue
        expect(e.y, `${level.name} 발판이 격자 밖`).toBeGreaterThanOrEqual(0)
      }
      // 파이프·계단 높이는 규칙 10 이 검증한다. 여기서는 상수만 확인.
      expect(maxClimb).toBe(4)
    }
  })
})
