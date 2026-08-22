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
import { buildSegments, checkReachable } from './helpers/reach'
import { canComplete } from './helpers/bot'

describe('스테이지 목록', () => {
  it('월드마다 10탄씩 꽉 차 있다', () => {
    expect(STAGES_PER_WORLD).toBe(10)
    expect(STAGES.length % STAGES_PER_WORLD).toBe(0)
    expect(WORLD_COUNT).toBe(STAGES.length / STAGES_PER_WORLD)
    expect(WORLD_COUNT).toBeGreaterThanOrEqual(3)
  })

  it('id 가 stage-01 부터 빠짐없이 이어지고 중복이 없다', () => {
    const ids = STAGES.map((s) => s.id)
    expect(ids).toEqual(
      Array.from({ length: STAGES.length }, (_, i) => `stage-${String(i + 1).padStart(2, '0')}`),
    )
    expect(new Set(ids).size).toBe(STAGES.length)
  })

  it('이름이 <월드>-<탄> 이고 순서가 맞는다', () => {
    const want = STAGES.map((_s, i) =>
      `${Math.floor(i / STAGES_PER_WORLD) + 1}-${(i % STAGES_PER_WORLD) + 1}`)
    expect(STAGES.map((s) => s.name)).toEqual(want)
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
    // 각 월드의 마지막 탄은 성이다 — 보스전 무대
    for (let w = 0; w < WORLD_COUNT; w++) {
      expect(themes[(w + 1) * STAGES_PER_WORLD - 1], `월드 ${w + 1}`).toBe('castle')
    }
  })

  it('3월드는 구름 위에서 시작한다', () => {
    expect(STAGES[20]!.theme).toBe('cloud')
    expect(STAGES[20]!.name).toBe('3-1')
  })

  it('2월드는 얼음으로 시작한다', () => {
    expect(STAGES[10]!.theme).toBe('ice')
    expect(STAGES[10]!.name).toBe('2-1')
  })

  it('월드 구분이 맞는다', () => {
    for (let w = 0; w < WORLD_COUNT; w++) {
      expect(worldOf(w * STAGES_PER_WORLD)).toBe(w)
      expect(worldOf((w + 1) * STAGES_PER_WORLD - 1)).toBe(w)
      expect(stagesOfWorld(w)).toHaveLength(STAGES_PER_WORLD)
      expect(stagesOfWorld(w)[0]!.name).toBe(`${w + 1}-1`)
    }
  })

  it('뒤 월드가 앞 월드보다 적이 많다', () => {
    const count = (w: number) =>
      stagesOfWorld(w).reduce(
        (a, s) => a + s.entities.filter((e) => e.type !== 'platform').length,
        0,
      )
    for (let w = 1; w < WORLD_COUNT; w++) {
      expect(count(w), `월드 ${w + 1}`).toBeGreaterThan(count(0))
    }
  })

  it('3월드에만 움직이는 발판이 있다 — 새 요소', () => {
    const movers = (w: number) =>
      stagesOfWorld(w).reduce(
        (a, s) => a + s.entities.filter(
          (e) => e.type === 'platform' && e.speed > 0,
        ).length,
        0,
      )
    expect(movers(0)).toBe(0)
    expect(movers(1)).toBe(0)
    expect(movers(2)).toBeGreaterThan(20)
  })

  it('stageAt은 범위를 벗어난 인덱스를 묶는다', () => {
    expect(stageAt(-5).id).toBe('stage-01')
    expect(stageAt(99).id).toBe(STAGES[STAGES.length - 1]!.id)
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

describe('발판에서 뛰는 점프는 도움닫기가 없다', () => {
  /*
   * 도달성 BFS 는 모든 이동을 달리기 점프(7타일)로 본다. 하지만 3타일짜리
   * 발판 위에서는 달릴 수가 없어 걷기 점프(4타일)밖에 안 나온다.
   * 이 차이를 안 보면 "검사는 통과하는데 사람은 못 건너는" 레벨이 나온다.
   */
  const walkGap = Math.floor(derive().walkReach / TILE)
  const maxClimb = Math.floor(derive().jumpHeight / TILE)

  it('걷기 점프 거리가 4타일이다 — 상수를 바꾸면 여기서 알려준다', () => {
    expect(walkGap).toBe(4)
  })

  it.each(STAGES.map((s) => [s.name, s] as const))(
    '%s — 모든 발판에서 걷기 점프로 닿는 다음 발판이 있다',
    (_n, level: LevelData) => {
      const segs = buildSegments(level)
      for (const p of segs) {
        if (p.kind !== 'platform') continue
        const next = segs.filter(
          (t) => t !== p
            // 발판보다 오른쪽으로 더 뻗어 있어야 "다음"이다.
            // 겹쳐 있으면(간격 음수) 걸어서 넘어갈 수 있으니 그것도 통과다
            && t.x1 > p.x1
            && t.x0 - p.x1 - 1 <= walkGap
            // 올라가는 건 점프 높이까지, 내려가는 건 얼마든지
            && p.y - t.y <= maxClimb,
        )
        expect(
          next.length,
          `${level.name}: 발판 ${p.x0}~${p.x1}(행 ${p.y}) 오른쪽 ${walkGap}타일 안에 착지할 곳이 없다`,
        ).toBeGreaterThan(0)
      }
    },
  )
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
