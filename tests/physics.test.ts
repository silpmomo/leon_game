import { describe, expect, it } from 'vitest'
import { applyGravity, moveX, moveY } from '../src/engine/physics'
import { parseTiles } from '../src/world/tilemap'
import { TILE, TUNING } from '../src/engine/tuning'
import type { Body } from '../src/types'

/** 6x4 격자, 맨 아래 한 줄이 땅 */
function flat() {
  return parseTiles(['......', '......', '......', '######']).grid
}

function body(x: number, y: number): Body {
  return { x, y, vx: 0, vy: 0, w: 11, h: 21, onGround: false }
}

const DT = 1 / 60

describe('applyGravity', () => {
  it('상승 중 버튼을 유지하면 약한 중력이 걸린다', () => {
    const b = body(0, 0)
    b.vy = -100
    applyGravity(b, DT, true)
    expect(b.vy).toBeCloseTo(-100 + TUNING.gravityRise * DT, 6)
  })

  it('버튼을 떼면 상승 중에도 강한 중력이 걸린다 (가변 점프)', () => {
    const b = body(0, 0)
    b.vy = -100
    applyGravity(b, DT, false)
    expect(b.vy).toBeCloseTo(-100 + TUNING.gravityFall * DT, 6)
  })

  it('같은 상황에서 버튼을 뗀 쪽이 더 빨리 떨어진다', () => {
    const held = body(0, 0)
    const released = body(0, 0)
    held.vy = -100
    released.vy = -100
    applyGravity(held, DT, true)
    applyGravity(released, DT, false)
    expect(released.vy).toBeGreaterThan(held.vy)
  })

  it('하강 중에는 버튼 상태와 무관하게 강한 중력', () => {
    const b = body(0, 0)
    b.vy = 10
    applyGravity(b, DT, true)
    expect(b.vy).toBeCloseTo(10 + TUNING.gravityFall * DT, 6)
  })

  it('최대 낙하속도를 넘지 않는다', () => {
    const b = body(0, 0)
    b.vy = TUNING.maxFall
    applyGravity(b, DT, false)
    expect(b.vy).toBe(TUNING.maxFall)
  })

  it('한 프레임 안에 최대 낙하속도를 뚫고 가속하지 않는다', () => {
    const b = body(0, 0)
    b.vy = TUNING.maxFall - 1
    applyGravity(b, DT, false)
    expect(b.vy).toBe(TUNING.maxFall)
  })
})

describe('moveY', () => {
  it('바닥에 닿으면 타일 경계에 정확히 정렬되고 onGround가 켜진다', () => {
    const grid = flat()
    const b = body(16, 20)
    b.vy = 200
    for (let i = 0; i < 20; i++) {
      applyGravity(b, 1 / 60, false)
      moveY(b, grid, 1 / 60, false)
      if (b.onGround) break
    }
    expect(b.onGround).toBe(true)
    expect(b.y + b.h).toBe(3 * TILE) // 땅은 ty=3
    expect(b.vy).toBe(0)
  })

  it('최대 낙하속도로 떨어져도 바닥을 관통하지 않는다 (터널링)', () => {
    const grid = flat()
    const b = body(16, 0)
    for (let i = 0; i < 200; i++) {
      b.vy = TUNING.maxFall
      moveY(b, grid, 1 / 60, false)
      expect(b.y + b.h).toBeLessThanOrEqual(3 * TILE)
    }
    expect(b.onGround).toBe(true)
  })

  it('천장을 치면 vy가 0이 되고 맞은 타일 좌표를 반환한다', () => {
    const grid = parseTiles(['##B###', '......', '......', '######']).grid
    const b = body(2 * TILE, 2 * TILE)
    b.vy = -300
    let hit = moveY(b, grid, 1 / 60, false)
    while (hit.hit === 'none') hit = moveY(b, grid, 1 / 60, false)
    expect(hit.hit).toBe('ceiling')
    expect(hit.tx).toBe(2)
    expect(hit.ty).toBe(0)
    expect(b.vy).toBe(0)
    expect(b.y).toBe(1 * TILE)
  })

  it('땅에 가만히 서 있으면 onGround가 흔들리지 않는다', () => {
    // 회귀: vy가 0으로 떨어지면 moveY의 두 분기를 모두 건너뛰어
    // onGround가 매 프레임 번갈아 false가 되던 버그.
    const grid = flat()
    const b = body(16, 0)
    for (let i = 0; i < 60 && !b.onGround; i++) {
      applyGravity(b, DT, false)
      moveY(b, grid, DT, false)
    }
    expect(b.onGround).toBe(true)

    for (let i = 0; i < 30; i++) {
      applyGravity(b, DT, false)
      moveY(b, grid, DT, false)
      expect(b.onGround, `프레임 ${i} 에서 공중 판정이 되었다`).toBe(true)
    }
  })

  it('vy가 정확히 0인 채로 호출해도 서 있는 상태를 유지한다', () => {
    const grid = flat()
    const b = body(16, 3 * TILE - 21)
    b.vy = 0
    moveY(b, grid, DT, false)
    expect(b.onGround).toBe(true)
  })

  it('땅에서 떨어지면 onGround가 꺼진다', () => {
    const grid = parseTiles(['......', '......', '###...', '###...']).grid
    const b = body(0, 0)

    // 왼쪽 지면 위에 정착시킨다
    for (let i = 0; i < 60 && !b.onGround; i++) {
      applyGravity(b, DT, false)
      moveY(b, grid, DT, false)
    }
    expect(b.onGround).toBe(true)
    expect(b.y + b.h).toBe(2 * TILE)

    // 지면이 없는 열로 옮기면 다음 프레임에 꺼진다
    b.x = 5 * TILE
    applyGravity(b, DT, false)
    moveY(b, grid, DT, false)
    expect(b.onGround).toBe(false)
  })
})

describe('moveX', () => {
  it('벽에 막히면 타일 경계에 정렬되고 vx가 0이 된다', () => {
    const grid = parseTiles(['...#..', '...#..', '...#..', '######']).grid
    const b = body(0, 0)
    b.vx = 400
    let blocked = false
    for (let i = 0; i < 30 && !blocked; i++) blocked = moveX(b, grid, 1 / 60)
    expect(blocked).toBe(true)
    expect(b.x + b.w).toBe(3 * TILE)
    expect(b.vx).toBe(0)
  })

  it('벽에 붙어 계속 밀어도 위치가 떨리지 않는다', () => {
    const grid = parseTiles(['...#..', '...#..', '...#..', '######']).grid
    const b = body(3 * TILE - 11, 0)
    const positions = new Set<number>()
    for (let i = 0; i < 10; i++) {
      b.vx = 400
      moveX(b, grid, 1 / 60)
      positions.add(b.x)
    }
    expect(positions.size).toBe(1)
  })

  it('왼쪽 벽도 같은 방식으로 정렬된다', () => {
    const grid = parseTiles(['#.....', '#.....', '#.....', '######']).grid
    const b = body(3 * TILE, 0)
    b.vx = -400
    let blocked = false
    for (let i = 0; i < 30 && !blocked; i++) blocked = moveX(b, grid, 1 / 60)
    expect(blocked).toBe(true)
    expect(b.x).toBe(1 * TILE)
  })
})

describe('코너 보정', () => {
  it('블록 모서리에 3px 이하로 걸치면 옆으로 밀어내고 상승을 유지한다', () => {
    // ty=0의 tx=2가 블록. 몸의 오른쪽 끝이 블록에 2px만 침범하게 둔다.
    const grid = parseTiles(['..B...', '......', '......', '######']).grid
    const b = body(2 * TILE - 11 + 2, TILE + 1)
    b.vy = -300
    const hit = moveY(b, grid, 1 / 60, true)
    expect(hit.hit).toBe('none')
    expect(b.vy).toBeLessThan(0) // 상승이 유지된다
    expect(b.x + b.w).toBeLessThanOrEqual(2 * TILE)
  })

  it('4px 이상 겹치면 보정하지 않고 천장으로 막는다', () => {
    const grid = parseTiles(['..B...', '......', '......', '######']).grid
    const b = body(2 * TILE - 11 + 6, TILE + 1)
    b.vy = -300
    const hit = moveY(b, grid, 1 / 60, true)
    expect(hit.hit).toBe('ceiling')
    expect(b.vy).toBe(0)
  })

  it('cornerCorrect=false면 보정하지 않는다 (적에게는 적용되지 않는다)', () => {
    const grid = parseTiles(['..B...', '......', '......', '######']).grid
    const b = body(2 * TILE - 11 + 2, TILE + 1)
    b.vy = -300
    expect(moveY(b, grid, 1 / 60, false).hit).toBe('ceiling')
  })
})
