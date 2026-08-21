import type { Body, TileGrid } from '../types'
import { TILE, TUNING } from './tuning'
import { solidAt } from '../world/tilemap'

export function applyGravity(b: Body, dt: number, holdingJump: boolean): void {
  const g = b.vy < 0 && holdingJump ? TUNING.gravityRise : TUNING.gravityFall
  b.vy = Math.min(b.vy + g * dt, TUNING.maxFall)
}

/** 몸이 걸치는 타일 행 범위 [y0, y1] */
function rowSpan(b: Body): [number, number] {
  return [Math.floor(b.y / TILE), Math.floor((b.y + b.h - 1) / TILE)]
}

/** 몸이 걸치는 타일 열 범위 [x0, x1] */
function colSpan(b: Body): [number, number] {
  return [Math.floor(b.x / TILE), Math.floor((b.x + b.w - 1) / TILE)]
}

export function moveX(b: Body, grid: TileGrid, dt: number): boolean {
  b.x += b.vx * dt
  const [y0, y1] = rowSpan(b)

  if (b.vx > 0) {
    const tx = Math.floor((b.x + b.w - 1) / TILE)
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

  if (b.vy > 0) {
    const ty = Math.floor((b.y + b.h - 1) / TILE)
    const [x0, x1] = colSpan(b)
    for (let tx = x0; tx <= x1; tx++) {
      if (solidAt(grid, tx, ty)) {
        b.y = ty * TILE - b.h
        b.vy = 0
        b.onGround = true
        return { hit: 'ground', tx, ty }
      }
    }
    b.onGround = false
    return NO_HIT
  }

  if (b.vy < 0) {
    const ty = Math.floor(b.y / TILE)
    const [x0, x1] = colSpan(b)
    for (let tx = x0; tx <= x1; tx++) {
      if (!solidAt(grid, tx, ty)) continue

      if (cornerCorrect && tryCornerNudge(b, grid, tx, ty)) return NO_HIT

      b.y = (ty + 1) * TILE
      b.vy = 0
      b.onGround = false
      return { hit: 'ceiling', tx, ty }
    }
  }

  b.onGround = false
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
