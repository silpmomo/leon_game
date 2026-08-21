import { describe, expect, it } from 'vitest'
import { assertValidLevel, maxPitWidth, validateLevel } from '../src/levels/schema'
import { TILE, derive } from '../src/engine/tuning'
import type { LevelData } from '../src/types'

function level(over: Partial<LevelData> = {}): LevelData {
  return {
    name: 't',
    id: 't',
    theme: 'day' as const,
    width: 12,
    height: 6,
    spawn: { x: 1, y: 4 },
    goal: { x: 10, flagTop: 1 },
    tiles: [
      '............',
      '............',
      '............',
      '............',
      '............',
      '############',
    ],
    entities: [],
    checkpoints: [],
    ...over,
  }
}

describe('maxPitWidth', () => {
  it('달리기 도달 거리에서 타일 수로 환산한다', () => {
    expect(maxPitWidth()).toBe(Math.floor(derive().runReach / TILE))
  })

  it('현재 상수로는 7타일이다', () => {
    expect(maxPitWidth()).toBe(7)
  })
})

describe('규칙 1 — 격자 크기', () => {
  it('행 길이가 width와 다르면 잡는다', () => {
    const issues = validateLevel(
      level({
        tiles: [
          '............',
          '............',
          '............',
          '............',
          '............',
          '###########',
        ],
      }),
    )
    expect(issues.some((i) => i.rule === 1)).toBe(true)
  })

  it('행 수가 height와 다르면 잡는다', () => {
    expect(validateLevel(level({ height: 7 })).some((i) => i.rule === 1)).toBe(true)
  })

  it('정상 격자는 통과한다', () => {
    expect(validateLevel(level()).filter((i) => i.rule === 1)).toEqual([])
  })
})

describe('규칙 2 — 미정의 문자', () => {
  it('정의되지 않은 문자를 잡는다', () => {
    const issues = validateLevel(
      level({
        tiles: [
          '............',
          '............',
          '............',
          '............',
          '.....%......',
          '############',
        ],
      }),
    )
    expect(issues.some((i) => i.rule === 2 && i.message.includes('%'))).toBe(true)
  })

  it('파싱이 실패하면 이후 규칙은 검사하지 않는다', () => {
    const issues = validateLevel(
      level({
        goal: { x: 99, flagTop: 1 },
        tiles: [
          '............',
          '............',
          '............',
          '............',
          '.....%......',
          '############',
        ],
      }),
    )
    expect(issues.some((i) => i.rule === 7)).toBe(false)
  })
})

describe('규칙 3 — spawn', () => {
  it('spawn이 블록 안이면 잡는다', () => {
    expect(validateLevel(level({ spawn: { x: 1, y: 5 } })).some((i) => i.rule === 3)).toBe(true)
  })

  it('spawn 아래가 허공이면 잡는다', () => {
    expect(validateLevel(level({ spawn: { x: 1, y: 2 } })).some((i) => i.rule === 3)).toBe(true)
  })

  it('정상 spawn은 통과한다', () => {
    expect(validateLevel(level()).filter((i) => i.rule === 3)).toEqual([])
  })
})

describe('규칙 4 — 구덩이 폭', () => {
  const withPit = (w: number): LevelData => {
    const ground = '##' + '.'.repeat(w) + '#'.repeat(12 - 2 - w)
    return level({
      tiles: [
        '............',
        '............',
        '............',
        '............',
        '............',
        ground,
      ],
    })
  }

  it('한계 이하 구덩이는 통과한다', () => {
    expect(validateLevel(withPit(5)).filter((i) => i.rule === 4)).toEqual([])
  })

  it('한계를 넘으면 잡고, 도달 거리를 메시지에 담는다', () => {
    const issues = validateLevel(withPit(9)).filter((i) => i.rule === 4)
    expect(issues).toHaveLength(1)
    expect(issues[0]!.message).toMatch(/9타일/)
    expect(issues[0]!.message).toMatch(/도달/)
  })

  it('이동발판이 걸쳐 있으면 폭 검사를 건너뛴다 (계획 정정 3)', () => {
    const wide = withPit(9)
    wide.entities = [{ type: 'platform', x: 5, y: 3, axis: 'x', range: 2, speed: 40 }]
    expect(validateLevel(wide).filter((i) => i.rule === 4)).toEqual([])
  })

  it('레벨 오른쪽 끝에서 끝나는 구덩이도 잡는다', () => {
    const bad = level({
      tiles: [
        '............',
        '............',
        '............',
        '............',
        '............',
        '##..........',
      ],
    })
    expect(validateLevel(bad).some((i) => i.rule === 4)).toBe(true)
  })
})

describe('규칙 5 — 통로 높이', () => {
  it('1타일 통로를 잡는다', () => {
    const issues = validateLevel(
      level({
        tiles: [
          '............',
          '............',
          '............',
          '####...#####', // 천장
          '............', // 통로 1타일
          '############',
        ],
      }),
    )
    expect(issues.some((i) => i.rule === 5)).toBe(true)
  })

  it('2타일 통로는 통과한다', () => {
    const issues = validateLevel(
      level({
        tiles: [
          '............',
          '............',
          '####...#####',
          '............',
          '............',
          '############',
        ],
      }),
    )
    expect(issues.filter((i) => i.rule === 5)).toEqual([])
  })

  it('땅이 두 줄이어도 오검출하지 않는다', () => {
    const issues = validateLevel(
      level({
        height: 6,
        tiles: [
          '............',
          '............',
          '............',
          '............',
          '############',
          '############',
        ],
        spawn: { x: 1, y: 3 },
      }),
    )
    expect(issues.filter((i) => i.rule === 5)).toEqual([])
  })
})

describe('규칙 6 — checkpoints', () => {
  it('허공 위 체크포인트를 잡는다', () => {
    const bad = level({
      checkpoints: [3],
      tiles: [
        '............',
        '............',
        '............',
        '............',
        '............',
        '##...#######',
      ],
    })
    expect(validateLevel(bad).some((i) => i.rule === 6)).toBe(true)
  })

  it('범위 밖 체크포인트를 잡는다', () => {
    expect(validateLevel(level({ checkpoints: [99] })).some((i) => i.rule === 6)).toBe(true)
  })

  it('천장까지 꽉 찬 열의 체크포인트를 잡는다 (설 자리가 없다)', () => {
    const bad = level({
      checkpoints: [5],
      tiles: [
        '.....#......',
        '.....#......',
        '.....#......',
        '.....#......',
        '.....#......',
        '############',
      ],
    })
    expect(validateLevel(bad).some((i) => i.rule === 6)).toBe(true)
  })

  it('땅 위에 단단블록이 놓인 열은 막힌 것이 아니다 (올라서면 된다)', () => {
    const ok = level({
      checkpoints: [5],
      tiles: [
        '............',
        '............',
        '............',
        '............',
        '#####H######',
        '############',
      ],
    })
    expect(validateLevel(ok).filter((i) => i.rule === 6)).toEqual([])
  })

  it('정상 체크포인트는 통과한다', () => {
    expect(validateLevel(level({ checkpoints: [6] })).filter((i) => i.rule === 6)).toEqual([])
  })

  it('땅이 두 줄이어도 오검출하지 않는다', () => {
    const two = level({
      checkpoints: [6],
      tiles: [
        '............',
        '............',
        '............',
        '............',
        '############',
        '############',
      ],
      spawn: { x: 1, y: 3 },
    })
    expect(validateLevel(two).filter((i) => i.rule === 6)).toEqual([])
  })
})

describe('규칙 7 — goal', () => {
  it('범위를 넘는 goal.x를 잡는다', () => {
    expect(validateLevel(level({ goal: { x: 50, flagTop: 1 } })).some((i) => i.rule === 7)).toBe(
      true,
    )
  })

  it('flagTop이 격자 밖이면 잡는다', () => {
    expect(validateLevel(level({ goal: { x: 10, flagTop: -1 } })).some((i) => i.rule === 7)).toBe(
      true,
    )
  })
})

describe('assertValidLevel', () => {
  it('정상 레벨은 조용히 지난다', () => {
    expect(() => assertValidLevel(level())).not.toThrow()
  })

  it('문제가 있으면 전부 모아 던진다', () => {
    const bad = level({ spawn: { x: 1, y: 5 }, goal: { x: 99, flagTop: 1 } })
    expect(() => assertValidLevel(bad)).toThrow(/규칙 3/)
    expect(() => assertValidLevel(bad)).toThrow(/규칙 7/)
  })

  it('오류 메시지에 건수와 레벨 이름이 들어간다', () => {
    expect(() => assertValidLevel(level({ name: '1-9', goal: { x: 99, flagTop: 1 } }))).toThrow(
      /1-9.*검증 실패/,
    )
  })
})
