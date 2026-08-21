import { TILE, derive } from '../../src/engine/tuning'
import { parseTiles, solidAt, tileAt } from '../../src/world/tilemap'
import type { LevelData } from '../../src/types'

/**
 * 지형 도달성 증명.
 *
 * "봇이 완주하는가"는 적 전투·타이밍 실력에 좌우되어 레벨 문제와 봇 한계를
 * 구분하지 못한다. 여기서는 적을 완전히 무시하고 **지형만으로 골에 닿을 수
 * 있는가**를 본다. 레벨 작성자가 실제로 저지르는 잘못(넘을 수 없는 구덩이,
 * 오를 수 없는 단차, 고립된 발판)이 정확히 이 검사에 걸린다.
 */

/** 서 있을 수 있는 칸들의 가로 연속 구간 */
export type Segment = {
  /** 타일 좌표 */
  x0: number
  x1: number
  /** 발이 놓이는 행 (이 칸이 비어 있고 아래가 solid) */
  y: number
  kind: 'terrain' | 'platform'
}

export type ReachResult = {
  ok: boolean
  segments: number
  reached: number
  /** 실패 시 골 쪽에서 가장 가까운 도달 지점 */
  furthestX: number
  reason: string
}

function standable(level: LevelData, grid: ReturnType<typeof parseTiles>['grid'], tx: number, ty: number): boolean {
  if (ty < 0 || ty >= level.height - 1) return false
  if (solidAt(grid, tx, ty)) return false
  const t = tileAt(grid, tx, ty)
  if (t === '^' || t === '~') return false
  if (!solidAt(grid, tx, ty + 1)) return false
  // 머리 위로 한 칸은 비어야 실제로 서 있을 수 있다 (작은 상태 1.3타일)
  if (solidAt(grid, tx, ty - 1)) return false
  return true
}

export function buildSegments(level: LevelData): Segment[] {
  const { grid } = parseTiles(level.tiles)
  const segs: Segment[] = []

  for (let ty = 0; ty < level.height; ty++) {
    let start = -1
    for (let tx = 0; tx <= level.width; tx++) {
      const ok = tx < level.width && standable(level, grid, tx, ty)
      if (ok && start === -1) start = tx
      if (!ok && start !== -1) {
        segs.push({ x0: start, x1: tx - 1, y: ty, kind: 'terrain' })
        start = -1
      }
    }
  }

  // 이동발판도 설 수 있는 면이다. 움직이는 범위를 합쳐 하나의 구간으로 본다.
  for (const e of level.entities) {
    if (e.type !== 'platform') continue
    const wTiles = 3
    const x0 = e.axis === 'x' ? e.x - e.range : e.x
    const x1 = (e.axis === 'x' ? e.x + e.range : e.x) + wTiles - 1
    const y = e.axis === 'y' ? e.y - e.range : e.y
    segs.push({ x0, x1, y, kind: 'platform' })
  }

  return segs
}

export function checkReachable(level: LevelData): ReachResult {
  const segs = buildSegments(level)
  const maxClimb = Math.floor(derive().jumpHeight / TILE)
  const maxGap = Math.floor(derive().runReach / TILE)

  if (segs.length === 0) {
    return { ok: false, segments: 0, reached: 0, furthestX: 0, reason: '설 수 있는 곳이 없다' }
  }

  /** a 에서 b 로 갈 수 있는가 */
  function connected(a: Segment, b: Segment): boolean {
    // 가로로 겹치면 같은 기둥 — 높이 차만 본다
    const overlap = a.x1 >= b.x0 - 1 && b.x1 >= a.x0 - 1
    const gap = overlap ? 0 : Math.max(b.x0 - a.x1 - 1, a.x0 - b.x1 - 1)
    if (gap > maxGap) return false
    const rise = a.y - b.y // b 가 위면 양수
    if (rise > maxClimb) return false
    return true
  }

  const startIdx = segs.findIndex(
    (sg) => sg.x0 <= level.spawn.x && level.spawn.x <= sg.x1 && sg.y === level.spawn.y,
  )
  const start = startIdx >= 0
    ? startIdx
    : segs.findIndex((sg) => sg.x0 <= level.spawn.x && level.spawn.x <= sg.x1)

  if (start < 0) {
    return {
      ok: false,
      segments: segs.length,
      reached: 0,
      furthestX: 0,
      reason: `스폰 (${level.spawn.x}, ${level.spawn.y}) 이 설 수 있는 구간에 없다`,
    }
  }

  const seen = new Set<number>([start])
  const queue = [start]
  let furthestX = segs[start]!.x1

  while (queue.length) {
    const cur = segs[queue.shift()!]!
    furthestX = Math.max(furthestX, cur.x1)
    for (let i = 0; i < segs.length; i++) {
      if (seen.has(i)) continue
      if (!connected(cur, segs[i]!)) continue
      seen.add(i)
      queue.push(i)
    }
  }

  const goalReached = [...seen].some((i) => {
    const sg = segs[i]!
    return sg.x0 - 1 <= level.goal.x && level.goal.x <= sg.x1 + 1
  })

  return {
    ok: goalReached,
    segments: segs.length,
    reached: seen.size,
    furthestX,
    reason: goalReached
      ? '골까지 도달 가능'
      : `골 ${level.goal.x} 에 닿지 못한다. 도달한 가장 오른쪽 타일 ${furthestX}`,
  }
}
