import type { Body, TileGrid } from '../types'
import { TILE, TUNING } from './tuning'
import { solidAt } from '../world/tilemap'

export function applyGravity(b: Body, dt: number, holdingJump: boolean): void {
  const g = b.vy < 0 && holdingJump ? TUNING.gravityRise : TUNING.gravityFall
  b.vy = Math.min(b.vy + g * dt, TUNING.maxFall)
}

/**
 * 몸은 반열린 구간 [x, x+w) 를 차지한다. 마지막으로 걸치는 타일을 구할 때
 * 정수 좌표용 관례인 `-1` 을 쓰면 부동소수 좌표에서 최대 1px을 미검출한다
 * (발이 y+h=48.83 이면 바닥 행을 0.83px 파고들었는데 floor((48.83-1)/16)=2 가
 * 되어 놓친다). 아주 작은 값만 빼서 경계에 정확히 붙은 경우만 제외한다.
 */
const EPS = 1e-6

/** 몸이 걸치는 타일 행 범위 [y0, y1] */
function rowSpan(b: Body): [number, number] {
  return [Math.floor(b.y / TILE), Math.floor((b.y + b.h - EPS) / TILE)]
}

/** 몸이 걸치는 타일 열 범위 [x0, x1] */
function colSpan(b: Body): [number, number] {
  return [Math.floor(b.x / TILE), Math.floor((b.x + b.w - EPS) / TILE)]
}

export function moveX(b: Body, grid: TileGrid, dt: number): boolean {
  b.x += b.vx * dt
  const [y0, y1] = rowSpan(b)

  if (b.vx > 0) {
    const tx = Math.floor((b.x + b.w - EPS) / TILE)
    for (let ty = y0; ty <= y1; ty++) {
      if (solidAt(grid, tx, ty)) {
        b.x = tx * TILE - b.w
        b.vx = 0
        return true
      }
    }
  } else if (b.vx < 0) {
    const tx = Math.floor(b.x / TILE)
    for (let ty = y0; ty <= y1; ty++) {
      if (solidAt(grid, tx, ty)) {
        b.x = (tx + 1) * TILE
        b.vx = 0
        return true
      }
    }
  }
  return false
}

export type VerticalHit = {
  hit: 'none' | 'ground' | 'ceiling'
  tx: number
  ty: number
}

const NO_HIT: VerticalHit = { hit: 'none', tx: -1, ty: -1 }

/**
 * 발밑 바로 아래 타일이 solid인가.
 *
 * 이 탐침이 없으면 땅에 가만히 서 있는 몸(vy === 0)이 매 프레임 번갈아
 * 공중 판정을 받는다. 중력이 vy를 키워 착지 → vy = 0 → 다음 프레임에
 * 두 분기 모두 건너뜀 → onGround = false 가 되기 때문이다.
 * 그 상태로는 코요테 타임이 계속 리셋되고 착지 이벤트가 반복 발동한다.
 */
function groundedBelow(b: Body, grid: TileGrid): boolean {
  const ty = Math.floor((b.y + b.h) / TILE)
  const [x0, x1] = colSpan(b)
  for (let tx = x0; tx <= x1; tx++) {
    if (solidAt(grid, tx, ty)) return true
  }
  return false
}

/**
 * cornerCorrect: 천장에 아주 살짝 걸쳤을 때 막는 대신 옆으로 밀어낸다.
 * 플레이어에게만 켠다 — 적에게 적용하면 적이 벽을 통과한다.
 */
export function moveY(
  b: Body,
  grid: TileGrid,
  dt: number,
  cornerCorrect: boolean,
): VerticalHit {
  b.y += b.vy * dt

  // 상승 중
  if (b.vy < 0) {
    const ty = Math.floor(b.y / TILE)
    const [x0, x1] = colSpan(b)
    for (let tx = x0; tx <= x1; tx++) {
      if (!solidAt(grid, tx, ty)) continue

      if (cornerCorrect && tryCornerNudge(b, grid, tx, ty)) {
        b.onGround = false
        return NO_HIT
      }

      b.y = (ty + 1) * TILE
      b.vy = 0
      b.onGround = false
      return { hit: 'ceiling', tx, ty }
    }
    b.onGround = false
    return NO_HIT
  }

  // 하강 또는 정지 — 파고든 타일이 있으면 착지
  const ty = Math.floor((b.y + b.h - EPS) / TILE)
  const [x0, x1] = colSpan(b)
  for (let tx = x0; tx <= x1; tx++) {
    if (solidAt(grid, tx, ty)) {
      b.y = ty * TILE - b.h
      b.vy = 0
      b.onGround = true
      return { hit: 'ground', tx, ty }
    }
  }

  // 파고들지 않았어도 발밑에 바닥이 붙어 있으면 서 있는 것이다
  b.onGround = groundedBelow(b, grid)
  return NO_HIT
}

/**
 * 몸이 tx 열에 cornerNudge 이하로만 걸쳐 있고 밀려날 쪽이 비어 있으면,
 * 몸을 그 열 밖으로 밀어내고 true. 원작에도 있는 관대함.
 */
function tryCornerNudge(b: Body, grid: TileGrid, tx: number, ty: number): boolean {
  const tileLeft = tx * TILE
  const tileRight = tileLeft + TILE

  const fromRight = b.x + b.w - tileLeft // 몸 오른쪽이 블록 왼쪽 경계를 넘은 양
  const fromLeft = tileRight - b.x // 몸 왼쪽이 블록 오른쪽 경계 안으로 든 양

  if (fromRight > 0 && fromRight <= TUNING.cornerNudge && !solidAt(grid, tx - 1, ty)) {
    b.x = tileLeft - b.w
    return true
  }
  if (fromLeft > 0 && fromLeft <= TUNING.cornerNudge && !solidAt(grid, tx + 1, ty)) {
    b.x = tileRight
    return true
  }
  return false
}
