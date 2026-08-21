import type { Coin, Tile, TileGrid } from '../types'
import { TILE } from '../engine/tuning'

export class LevelParseError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'LevelParseError'
  }
}

export const TILE_CHARS = ['.', '#', 'B', 'b', '?', '@', '*', 'H', 'p', '|', 'o'] as const

const SOLID = new Set<Tile>(['#', 'B', 'b', '?', '@', '*', 'H', 'p', '|'])
const BRICKS = new Set<Tile>(['B', 'b'])
const QUESTIONS = new Set<Tile>(['?', '@', '*'])

export function isTileChar(c: string): c is Tile {
  return (TILE_CHARS as readonly string[]).includes(c)
}

export function isBrick(t: Tile): boolean {
  return BRICKS.has(t)
}

export function isQuestion(t: Tile): boolean {
  return QUESTIONS.has(t)
}

export function idx(grid: TileGrid, tx: number, ty: number): number {
  return ty * grid.w + tx
}

function inBounds(grid: TileGrid, tx: number, ty: number): boolean {
  return tx >= 0 && tx < grid.w && ty >= 0 && ty < grid.h
}

export function parseTiles(rows: string[]): { grid: TileGrid; coins: Coin[] } {
  if (rows.length === 0) throw new LevelParseError('타일 행이 비어 있다')

  const w = rows[0]!.length
  if (w === 0) throw new LevelParseError('1행이 비어 있다')

  const h = rows.length
  const cells: Tile[] = new Array<Tile>(w * h).fill('.')
  const coins: Coin[] = []

  for (let ty = 0; ty < h; ty++) {
    const row = rows[ty]!
    if (row.length !== w) {
      throw new LevelParseError(
        `${ty + 1}행의 길이 ${row.length} 가 1행의 길이 ${w} 와 다르다`,
      )
    }
    for (let tx = 0; tx < w; tx++) {
      const c = row[tx]!
      if (!isTileChar(c)) {
        throw new LevelParseError(
          `${ty + 1}행 ${tx + 1}번째 문자 '${c}' 는 정의되지 않은 타일이다`,
        )
      }
      if (c === 'o') {
        // 코인은 타일이 아니라 수집물이다. 10x14를 타일 중앙에 놓는다.
        coins.push({ x: tx * TILE + 3, y: ty * TILE + 1, w: 10, h: 14, taken: false })
        continue // 격자에는 '.' 를 남긴다
      }
      cells[ty * w + tx] = c
    }
  }

  return {
    grid: { w, h, cells, broken: new Uint8Array(w * h), used: new Uint8Array(w * h) },
    coins,
  }
}

export function tileAt(grid: TileGrid, tx: number, ty: number): Tile {
  if (!inBounds(grid, tx, ty)) return '.'
  const i = idx(grid, tx, ty)
  if (grid.broken[i] === 1) return '.'
  if (grid.used[i] === 1) return 'H' // 사용된 ? 블록은 단단블록처럼 굳는다
  return grid.cells[i]!
}

export function solidAt(grid: TileGrid, tx: number, ty: number): boolean {
  return SOLID.has(tileAt(grid, tx, ty))
}

export function breakBrick(grid: TileGrid, tx: number, ty: number): void {
  if (!inBounds(grid, tx, ty)) return
  const i = idx(grid, tx, ty)
  if (!isBrick(grid.cells[i]!)) return
  grid.broken[i] = 1
}

export function useQuestion(grid: TileGrid, tx: number, ty: number): void {
  if (!inBounds(grid, tx, ty)) return
  const i = idx(grid, tx, ty)
  if (!isQuestion(grid.cells[i]!)) return
  grid.used[i] = 1
}
