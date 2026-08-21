import { describe, expect, it } from 'vitest'
import {
  LevelParseError,
  breakBrick,
  isBrick,
  isQuestion,
  parseTiles,
  solidAt,
  tileAt,
  useQuestion,
} from '../src/world/tilemap'

const ROWS = ['....o.', '..B?@.', '######']

describe('parseTiles', () => {
  it('격자 크기를 행/열에서 읽는다', () => {
    const { grid } = parseTiles(ROWS)
    expect(grid.w).toBe(6)
    expect(grid.h).toBe(3)
  })

  it('o는 Coin으로 빠지고 격자에는 빈칸이 남는다', () => {
    const { grid, coins } = parseTiles(ROWS)
    expect(coins).toHaveLength(1)
    expect(coins[0]).toEqual({ x: 4 * 16 + 3, y: 0 * 16 + 1, w: 10, h: 14, taken: false })
    expect(tileAt(grid, 4, 0)).toBe('.')
  })

  it('행 길이가 다르면 사람이 읽을 수 있는 오류를 던진다', () => {
    expect(() => parseTiles(['###', '##'])).toThrow(LevelParseError)
    expect(() => parseTiles(['###', '##'])).toThrow(/2행.*길이 2.*3/)
  })

  it('미정의 문자는 행·열·문자를 알려주며 실패한다', () => {
    expect(() => parseTiles(['##', '#%'])).toThrow(/2행 2번째 문자 '%'/)
  })

  it('빈 입력은 실패한다', () => {
    expect(() => parseTiles([])).toThrow(LevelParseError)
  })
})

describe('tileAt', () => {
  it('범위 밖은 빈칸으로 취급한다', () => {
    const { grid } = parseTiles(ROWS)
    expect(tileAt(grid, -1, 0)).toBe('.')
    expect(tileAt(grid, 99, 0)).toBe('.')
    expect(tileAt(grid, 0, -1)).toBe('.')
    expect(tileAt(grid, 0, 99)).toBe('.')
  })
})

describe('solidAt', () => {
  const { grid } = parseTiles(ROWS)

  it('땅·벽돌·? 블록·단단블록·파이프는 solid', () => {
    expect(solidAt(grid, 0, 2)).toBe(true) // #
    expect(solidAt(grid, 2, 1)).toBe(true) // B
    expect(solidAt(grid, 3, 1)).toBe(true) // ?
    expect(solidAt(grid, 4, 1)).toBe(true) // @
  })

  it('빈칸은 solid가 아니다', () => {
    expect(solidAt(grid, 0, 0)).toBe(false)
  })

  it('범위 밖은 solid가 아니다 (좌우 끝에서 막히지 않는다)', () => {
    expect(solidAt(grid, -1, 2)).toBe(false)
  })
})

describe('블록 상태 변화', () => {
  it('부서진 벽돌은 solid가 아니게 된다', () => {
    const { grid } = parseTiles(ROWS)
    expect(solidAt(grid, 2, 1)).toBe(true)
    breakBrick(grid, 2, 1)
    expect(solidAt(grid, 2, 1)).toBe(false)
    expect(tileAt(grid, 2, 1)).toBe('.')
  })

  it('사용된 ? 블록은 여전히 solid이지만 다시 쓸 수 없다', () => {
    const { grid } = parseTiles(ROWS)
    expect(isQuestion(tileAt(grid, 3, 1))).toBe(true)
    useQuestion(grid, 3, 1)
    expect(solidAt(grid, 3, 1)).toBe(true)
    expect(isQuestion(tileAt(grid, 3, 1))).toBe(false)
  })

  it('땅은 부서지지 않는다', () => {
    const { grid } = parseTiles(ROWS)
    breakBrick(grid, 0, 2)
    expect(solidAt(grid, 0, 2)).toBe(true)
  })
})

describe('분류 함수', () => {
  it('isBrick은 B와 b만', () => {
    expect(isBrick('B')).toBe(true)
    expect(isBrick('b')).toBe(true)
    expect(isBrick('#')).toBe(false)
  })

  it('isQuestion은 ? @ *만', () => {
    expect(isQuestion('?')).toBe(true)
    expect(isQuestion('@')).toBe(true)
    expect(isQuestion('*')).toBe(true)
    expect(isQuestion('B')).toBe(false)
  })
})
