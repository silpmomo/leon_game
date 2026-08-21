import { describe, expect, it } from 'vitest'
import {
  PLAYER_SIZE,
  createPlayer,
  maxSpeedFor,
  resizePlayer,
  updatePlayer,
} from '../src/world/player'
import { parseTiles } from '../src/world/tilemap'
import { TILE, TUNING, derive } from '../src/engine/tuning'
import { EMPTY_INPUT, type InputState, type Player, type TileGrid } from '../src/types'

const DT = 1 / 60
const input = (over: Partial<InputState> = {}): InputState => ({ ...EMPTY_INPUT, ...over })

/** 넓은 평지. 위 4줄이 하늘, 맨 아래가 땅 */
function ground(): TileGrid {
  return parseTiles([
    '....................',
    '....................',
    '....................',
    '....................',
    '####################',
  ]).grid
}

/** 지면에 정착할 때까지 돌린다 */
function settle(p: Player, grid: TileGrid): void {
  for (let i = 0; i < 40; i++) updatePlayer(p, input(), grid, DT)
}

function standing(): { grid: TileGrid; p: Player } {
  const grid = ground()
  const p = createPlayer(2, 3)
  settle(p, grid)
  return { grid, p }
}

/** 점프 버튼을 releaseAfter 프레임까지 유지했을 때 도달하는 최고 높이(타일) */
function peakHeight(releaseAfter: number): number {
  const { grid, p } = standing()
  const start = p.y + p.h
  let peak = start
  updatePlayer(p, input({ jump: true, jumpPressed: true }), grid, DT)
  for (let i = 0; i < 300; i++) {
    updatePlayer(p, input(i < releaseAfter ? { jump: true } : {}), grid, DT)
    peak = Math.min(peak, p.y + p.h)
    if (p.onGround) break
  }
  return (start - peak) / TILE
}

describe('createPlayer / resizePlayer', () => {
  it('작은 상태는 11x21이고 지정 타일 위에 발을 붙인다', () => {
    const p = createPlayer(2, 3)
    expect(p.w).toBe(11)
    expect(p.h).toBe(21)
    expect(p.y + p.h).toBe(4 * TILE)
  })

  it('커질 때 발밑이 유지된다 (땅에 박히지 않는다)', () => {
    const p = createPlayer(2, 3)
    const feet = p.y + p.h
    resizePlayer(p, 'big')
    expect(p.w).toBe(PLAYER_SIZE.big.w)
    expect(p.h).toBe(PLAYER_SIZE.big.h)
    expect(p.y + p.h).toBe(feet)
  })

  it('커질 때 가로 중심이 유지된다', () => {
    const p = createPlayer(2, 3)
    const cx = p.x + p.w / 2
    resizePlayer(p, 'big')
    expect(p.x + p.w / 2).toBeCloseTo(cx, 6)
  })

  it('ball 상태는 big과 같은 크기다', () => {
    const p = createPlayer(2, 3)
    resizePlayer(p, 'ball')
    expect(p.h).toBe(PLAYER_SIZE.big.h)
  })

  it('작은 상태 높이는 1타일을 넘는다 — 통로 최소 2타일 제약의 근거', () => {
    expect(PLAYER_SIZE.small.h).toBeGreaterThan(TILE)
    expect(PLAYER_SIZE.small.h).toBeLessThan(2 * TILE)
  })
})

describe('maxSpeedFor — 달리기 자동 가속', () => {
  it('방향 버튼을 막 눌렀을 때는 걷기 속도', () => {
    const p = createPlayer(2, 3)
    p.runMs = 0
    expect(maxSpeedFor(p)).toBe(TUNING.walkMax)
  })

  it('runRampMs를 채우면 달리기 속도', () => {
    const p = createPlayer(2, 3)
    p.runMs = TUNING.runRampMs
    expect(maxSpeedFor(p)).toBe(TUNING.runMax)
  })

  it('절반 지점에서는 중간값', () => {
    const p = createPlayer(2, 3)
    p.runMs = TUNING.runRampMs / 2
    expect(maxSpeedFor(p)).toBeCloseTo((TUNING.walkMax + TUNING.runMax) / 2, 5)
  })

  it('상한을 넘겨도 달리기 속도에서 멈춘다', () => {
    const p = createPlayer(2, 3)
    p.runMs = TUNING.runRampMs * 10
    expect(maxSpeedFor(p)).toBe(TUNING.runMax)
  })

  it('72프레임(1.2초) 유지하면 실제로 달리기 최고속도에 닿는다', () => {
    const { grid, p } = standing()
    for (let i = 0; i < 72; i++) updatePlayer(p, input({ right: true }), grid, DT)
    expect(p.vx).toBeCloseTo(TUNING.runMax, 5)
  })

  it('방향 버튼을 떼면 runMs가 0으로 초기화된다', () => {
    const { grid, p } = standing()
    for (let i = 0; i < 60; i++) updatePlayer(p, input({ right: true }), grid, DT)
    expect(p.runMs).toBeGreaterThan(0)
    updatePlayer(p, input(), grid, DT)
    expect(p.runMs).toBe(0)
  })
})

describe('가변 점프', () => {
  it('땅에서 점프 버튼을 누르면 상승한다', () => {
    const { grid, p } = standing()
    const step = updatePlayer(p, input({ jump: true, jumpPressed: true }), grid, DT)
    expect(step.jumped).toBe(true)
    expect(p.vy).toBeLessThan(0)
  })

  it('버튼을 끝까지 누르면 4.7타일 근처까지 오른다', () => {
    const h = peakHeight(300)
    expect(h).toBeGreaterThan(4.6)
    expect(h).toBeLessThan(4.9)
  })

  it('톡 치면 1타일 미만으로 짧게 뛴다', () => {
    const h = peakHeight(0)
    expect(h).toBeGreaterThan(0.5)
    expect(h).toBeLessThan(1.1)
  })

  it('누르는 시간에 따라 높이가 단조 증가한다', () => {
    const heights = [0, 3, 6, 12, 300].map(peakHeight)
    for (let i = 1; i < heights.length; i++) {
      expect(heights[i]!).toBeGreaterThan(heights[i - 1]!)
    }
  })

  it('최소 점프와 최대 점프의 차이가 3타일을 넘는다 (조절 폭이 의미 있다)', () => {
    expect(peakHeight(300) - peakHeight(0)).toBeGreaterThan(3)
  })

  it('공중에서 다시 눌러도 이단 점프가 되지 않는다', () => {
    const { grid, p } = standing()
    updatePlayer(p, input({ jump: true, jumpPressed: true }), grid, DT)
    for (let i = 0; i < 10; i++) updatePlayer(p, input({ jump: true }), grid, DT)
    const vyBefore = p.vy
    const step = updatePlayer(p, input({ jump: true, jumpPressed: true }), grid, DT)
    expect(step.jumped).toBe(false)
    expect(p.vy).toBeGreaterThan(vyBefore) // 계속 중력만 받는다
  })
})

describe('코요테 타임', () => {
  /** 왼쪽 6타일만 지면 */
  function cliff(): TileGrid {
    return parseTiles([
      '....................',
      '....................',
      '....................',
      '....................',
      '######..............',
    ]).grid
  }

  function walkOffEdge(): { grid: TileGrid; p: Player } {
    const grid = cliff()
    const p = createPlayer(1, 3)
    settle(p, grid)
    for (let i = 0; i < 200 && p.onGround; i++) {
      updatePlayer(p, input({ right: true }), grid, DT)
    }
    return { grid, p }
  }

  it('절벽을 떠난 직후에는 코요테 시간이 남아 있다', () => {
    const { p } = walkOffEdge()
    expect(p.onGround).toBe(false)
    expect(p.coyoteMs).toBeGreaterThan(0)
  })

  it('코요테 시간 안에는 점프가 성립한다', () => {
    const { grid, p } = walkOffEdge()
    const step = updatePlayer(p, input({ jump: true, jumpPressed: true }), grid, DT)
    expect(step.jumped).toBe(true)
  })

  it('코요테 시간이 지나면 점프가 성립하지 않는다', () => {
    const { grid, p } = walkOffEdge()
    // 80ms = 4.8프레임. 여유 있게 8프레임 흘린다.
    for (let i = 0; i < 8; i++) updatePlayer(p, input({ right: true }), grid, DT)
    expect(p.coyoteMs).toBe(0)
    const step = updatePlayer(p, input({ right: true, jump: true, jumpPressed: true }), grid, DT)
    expect(step.jumped).toBe(false)
  })
})

describe('점프 버퍼', () => {
  it('착지 직전에 누른 점프가 착지 즉시 발동한다', () => {
    const grid = ground()
    const p = createPlayer(2, 0) // 공중에서 시작
    let pressed = false
    let jumpedAfterLanding = false

    for (let i = 0; i < 120; i++) {
      // 착지 직전(발밑이 땅에서 10px 이내)에 한 번만 누른다
      const nearGround = p.y + p.h > 4 * TILE - 10 && !p.onGround
      const press = nearGround && !pressed
      if (press) pressed = true
      const step = updatePlayer(p, input({ jump: press, jumpPressed: press }), grid, DT)
      if (step.jumped) {
        jumpedAfterLanding = true
        break
      }
    }
    expect(pressed).toBe(true)
    expect(jumpedAfterLanding).toBe(true)
  })

  it('버퍼는 눌린 순간 채워지고 시간이 지나면 0이 된다', () => {
    const grid = ground()
    const p = createPlayer(2, 0)
    updatePlayer(p, input({ jump: true, jumpPressed: true }), grid, DT) // 공중 헛입력
    expect(p.jumpBufferMs).toBeGreaterThan(0)
    // 120ms = 7.2프레임. 10프레임 흘린다.
    for (let i = 0; i < 10; i++) updatePlayer(p, input(), grid, DT)
    expect(p.jumpBufferMs).toBe(0)
  })
})

describe('스키드', () => {
  it('달리는 중 반대 방향을 누르면 skidding이 켜지고 더 빨리 감속한다', () => {
    const { grid, p } = standing()
    for (let i = 0; i < 60; i++) updatePlayer(p, input({ right: true }), grid, DT)
    const vxBefore = p.vx
    expect(vxBefore).toBeGreaterThan(0)
    updatePlayer(p, input({ left: true }), grid, DT)
    expect(p.skidding).toBe(true)
    expect(p.vx).toBeLessThan(vxBefore - TUNING.decel * DT)
  })

  it('같은 방향으로 계속 가면 skidding은 꺼져 있다', () => {
    const { grid, p } = standing()
    for (let i = 0; i < 30; i++) updatePlayer(p, input({ right: true }), grid, DT)
    expect(p.skidding).toBe(false)
  })

  it('공중에서는 skidding이 켜지지 않는다', () => {
    const { grid, p } = standing()
    for (let i = 0; i < 60; i++) updatePlayer(p, input({ right: true }), grid, DT)
    updatePlayer(p, input({ right: true, jump: true, jumpPressed: true }), grid, DT)
    updatePlayer(p, input({ left: true, jump: true }), grid, DT)
    expect(p.onGround).toBe(false)
    expect(p.skidding).toBe(false)
  })
})

describe('바라보는 방향', () => {
  it('입력 방향을 따라간다', () => {
    const { grid, p } = standing()
    updatePlayer(p, input({ left: true }), grid, DT)
    expect(p.facing).toBe(-1)
    updatePlayer(p, input({ right: true }), grid, DT)
    expect(p.facing).toBe(1)
  })

  it('좌우 동시 입력은 정지로 취급한다 (입력 계층에서 이미 하나로 줄여 온다)', () => {
    const { grid, p } = standing()
    for (let i = 0; i < 30; i++) updatePlayer(p, input({ right: true }), grid, DT)
    const vxBefore = p.vx
    updatePlayer(p, input({ left: true, right: true }), grid, DT)
    expect(p.vx).toBeLessThan(vxBefore)
    expect(p.runMs).toBe(0)
  })
})

describe('구덩이 통과 — D구간 설계 근거', () => {
  /** 왼쪽 6타일 지면 → pitWidth 구덩이 → 오른쪽 지면 */
  function pit(pitWidth: number): TileGrid {
    const total = 20
    const right = total - 6 - pitWidth
    return parseTiles([
      '....................',
      '....................',
      '....................',
      '....................',
      '#'.repeat(6) + '.'.repeat(pitWidth) + '#'.repeat(right),
    ]).grid
  }

  /**
   * 절벽 끝에서 최고 점프로 뛰어 건너는지 본다.
   * startSpeed 를 직접 넣어 걷기/달리기 속도를 분리한다 —
   * 유지 시간에 맡기면 긴 활주로에서는 늘 달리기 속도가 되어 구분이 안 된다.
   */
  function crosses(pitWidth: number, startSpeed: number): boolean {
    const grid = pit(pitWidth)
    const p = createPlayer(4, 3)
    settle(p, grid)

    const running = startSpeed >= TUNING.runMax
    let jumped = false

    for (let i = 0; i < 400; i++) {
      // runMs를 매 프레임 고정해 속도 상한을 걷기/달리기로 못박는다.
      // 유지 시간에 맡기면 긴 활주로에서는 늘 달리기 속도가 되어 구분이 안 된다.
      p.runMs = running ? TUNING.runRampMs : 0
      p.vx = Math.min(p.vx, startSpeed)

      const atEdge = p.x + p.w >= 6 * TILE - 2
      const press = atEdge && !jumped && p.onGround
      if (press) jumped = true

      updatePlayer(p, input({ right: true, jump: jumped, jumpPressed: press }), grid, DT)
      if (p.y > 5 * TILE + 40) return false // 낙하사
      if (jumped && p.onGround && p.x > (6 + pitWidth) * TILE) return true
    }
    return false
  }

  it('걷기 속도로는 3타일 구덩이를 넘는다', () => {
    expect(crosses(3, TUNING.walkMax)).toBe(true)
  })

  it('걷기 속도로는 5타일 구덩이를 넘지 못한다', () => {
    expect(crosses(5, TUNING.walkMax)).toBe(false)
  })

  it('달리기 속도로는 5타일 구덩이를 넘는다', () => {
    expect(crosses(5, TUNING.runMax)).toBe(true)
  })

  it('파생 계산과 실측이 같은 방향을 가리킨다', () => {
    const d = derive()
    expect(d.walkReach).toBeLessThan(5 * TILE)
    expect(d.runReach).toBeGreaterThan(5 * TILE)
  })
})
