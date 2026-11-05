import type { ArenaGrid, ArenaMap, ArenaTile } from './types'
import { CRATE_HP, FIGHTER_R, TILE } from './tuning'

/**
 * 맵 격자 — 파싱 · 충돌 · 길찾기.
 *
 * 맵은 왼쪽 위 4분면만 손으로 그리고 좌우·상하로 거울 복사한다.
 * 그래서 모든 시작점이 같은 조건이다.
 */

const TILES = new Set(['.', '#', 'w', '"', 'x', 'S'])

export type Parsed = { grid: ArenaGrid; spawns: [number, number][] }

/** 4분면 → 전체 아스키 행 */
export function mirrorRows(quadrant: readonly string[]): string[] {
  const top = quadrant.map((row) => row + [...row].reverse().join(''))
  return [...top, ...[...top].reverse()]
}

export function parseMap(map: ArenaMap): Parsed {
  const rows = mirrorRows(map.quadrant)
  const h = rows.length
  const w = rows[0]?.length ?? 0
  const cells: ArenaTile[] = new Array(w * h)
  const crateHp = new Float32Array(w * h)
  const spawns: [number, number][] = []
  for (let y = 0; y < h; y++) {
    const row = rows[y]!
    for (let x = 0; x < w; x++) {
      const ch = row[x] ?? '.'
      if (!TILES.has(ch)) throw new Error(`${map.id}: 모르는 타일 '${ch}' (${x},${y})`)
      if (ch === 'S') {
        spawns.push([(x + 0.5) * TILE, (y + 0.5) * TILE])
        cells[y * w + x] = '.'
        continue
      }
      cells[y * w + x] = ch as ArenaTile
      if (ch === 'x') crateHp[y * w + x] = CRATE_HP
    }
  }
  return { grid: { w, h, cells, crateHp }, spawns }
}

export function tileAt(g: ArenaGrid, tx: number, ty: number): ArenaTile | null {
  if (tx < 0 || ty < 0 || tx >= g.w || ty >= g.h) return null
  return g.cells[ty * g.w + tx]!
}

export function tileAtPx(g: ArenaGrid, x: number, y: number): ArenaTile | null {
  return tileAt(g, Math.floor(x / TILE), Math.floor(y / TILE))
}

/** 걸어서 못 지나가는 칸. 맵 밖도 막혀 있다 */
export function blocksMove(t: ArenaTile | null): boolean {
  return t === null || t === '#' || t === 'w' || t === 'x'
}

/** 탄을 막는 칸. 물은 탄이 넘어간다 */
export function blocksShot(t: ArenaTile | null): boolean {
  return t === null || t === '#' || t === 'x'
}

export function inBush(g: ArenaGrid, x: number, y: number): boolean {
  return tileAtPx(g, x, y) === '"'
}

function boxHits(g: ArenaGrid, x: number, y: number): boolean {
  const r = FIGHTER_R - 0.01
  const x0 = Math.floor((x - r) / TILE)
  const x1 = Math.floor((x + r) / TILE)
  const y0 = Math.floor((y - r) / TILE)
  const y1 = Math.floor((y + r) / TILE)
  for (let ty = y0; ty <= y1; ty++) {
    for (let tx = x0; tx <= x1; tx++) {
      if (blocksMove(tileAt(g, tx, ty))) return true
    }
  }
  return false
}

/**
 * 축별로 나눠 움직인다. 벽에 비스듬히 붙어도 미끄러져 나간다.
 * 한 번에 TILE 을 넘게 움직이지 않는다는 가정이다 (62px/s × 1/60s ≈ 1px).
 */
export function moveBox(
  g: ArenaGrid, x: number, y: number, dx: number, dy: number,
): [number, number] {
  let nx = x + dx
  if (boxHits(g, nx, y)) nx = x
  let ny = y + dy
  if (boxHits(g, nx, ny)) ny = y
  return [nx, ny]
}

export function canStand(g: ArenaGrid, x: number, y: number): boolean {
  return !boxHits(g, x, y)
}

/** 상자를 부순다. 남은 체력이 0 이 되면 true */
export function damageCrate(g: ArenaGrid, tx: number, ty: number, dmg: number): boolean {
  const i = ty * g.w + tx
  if (g.cells[i] !== 'x') return false
  g.crateHp[i] = Math.max(0, g.crateHp[i]! - dmg)
  if (g.crateHp[i]! > 0) return false
  g.cells[i] = '.'
  return true
}

/** 두 점 사이에 탄을 막는 칸이 없는가 (반 타일 간격 표본) */
export function clearShot(g: ArenaGrid, ax: number, ay: number, bx: number, by: number): boolean {
  const d = Math.hypot(bx - ax, by - ay)
  const n = Math.max(1, Math.ceil(d / (TILE / 2)))
  for (let i = 1; i < n; i++) {
    const k = i / n
    if (blocksShot(tileAtPx(g, ax + (bx - ax) * k, ay + (by - ay) * k))) return false
  }
  return true
}

const DIRS: readonly [number, number][] = [[1, 0], [-1, 0], [0, 1], [0, -1]]

/**
 * 목적지까지의 거리장(BFS)을 만들어 지금 칸에서 한 칸 나아갈 곳을 준다.
 * 목적지가 막힌 칸(상자 등)이면 그 이웃까지 간다.
 * 길이 없으면 null.
 */
export function nextStep(
  g: ArenaGrid, fromX: number, fromY: number, toX: number, toY: number,
): [number, number] | null {
  const sx = Math.floor(fromX / TILE)
  const sy = Math.floor(fromY / TILE)
  const gx = Math.floor(toX / TILE)
  const gy = Math.floor(toY / TILE)
  if (sx === gx && sy === gy) return [toX, toY]

  const dist = new Int16Array(g.w * g.h).fill(-1)
  const queue: number[] = []
  const seed = (tx: number, ty: number): void => {
    if (tx < 0 || ty < 0 || tx >= g.w || ty >= g.h) return
    const i = ty * g.w + tx
    if (dist[i] !== -1 || blocksMove(g.cells[i]!)) return
    dist[i] = 0
    queue.push(i)
  }
  if (blocksMove(tileAt(g, gx, gy))) {
    for (const [dx, dy] of DIRS) seed(gx + dx, gy + dy)
  } else {
    seed(gx, gy)
  }

  const start = sy * g.w + sx
  for (let head = 0; head < queue.length; head++) {
    const i = queue[head]!
    if (i === start) break
    const tx = i % g.w
    const ty = (i - tx) / g.w
    for (const [dx, dy] of DIRS) {
      const nx = tx + dx
      const ny = ty + dy
      if (nx < 0 || ny < 0 || nx >= g.w || ny >= g.h) continue
      const j = ny * g.w + nx
      if (dist[j] !== -1 || blocksMove(g.cells[j]!)) continue
      dist[j] = dist[i]! + 1
      queue.push(j)
    }
  }
  if (dist[start] === -1) return null
  if (dist[start] === 0) return [toX, toY]

  let best: [number, number] | null = null
  let bestD = dist[start]!
  for (const [dx, dy] of DIRS) {
    const nx = sx + dx
    const ny = sy + dy
    if (nx < 0 || ny < 0 || nx >= g.w || ny >= g.h) continue
    const d = dist[ny * g.w + nx]!
    if (d >= 0 && d < bestD) {
      bestD = d
      best = [(nx + 0.5) * TILE, (ny + 0.5) * TILE]
    }
  }
  return best
}

/** 상자도 지나갈 수 있다고 칠 때, 시작점에서 닿는 칸 수 (검증용) */
export function reachableFrom(g: ArenaGrid, x: number, y: number): Uint8Array {
  const seen = new Uint8Array(g.w * g.h)
  const sx = Math.floor(x / TILE)
  const sy = Math.floor(y / TILE)
  const passable = (t: ArenaTile): boolean => t !== '#' && t !== 'w'
  if (!passable(g.cells[sy * g.w + sx]!)) return seen
  const queue = [sy * g.w + sx]
  seen[queue[0]!] = 1
  for (let head = 0; head < queue.length; head++) {
    const i = queue[head]!
    const tx = i % g.w
    const ty = (i - tx) / g.w
    for (const [dx, dy] of DIRS) {
      const nx = tx + dx
      const ny = ty + dy
      if (nx < 0 || ny < 0 || nx >= g.w || ny >= g.h) continue
      const j = ny * g.w + nx
      if (seen[j] || !passable(g.cells[j]!)) continue
      seen[j] = 1
      queue.push(j)
    }
  }
  return seen
}

