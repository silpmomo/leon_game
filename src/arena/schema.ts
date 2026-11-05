import type { ArenaMap } from './types'
import { canStand, parseMap, reachableFrom } from './grid'
import { MAP_H, MAP_W, TILE } from './tuning'

/**
 * 맵 검증. 부팅할 때 main.ts 가 부르고 테스트도 같은 함수를 쓴다.
 * 잘못된 맵으로 들어가면 아이는 "왜 못 가?"만 남는다.
 */
export function arenaMapProblems(m: ArenaMap): string[] {
  const out: string[] = []
  const qw = MAP_W / 2
  const qh = MAP_H / 2
  if (m.quadrant.length !== qh) out.push(`4분면 행 수 ${m.quadrant.length} ≠ ${qh}`)
  m.quadrant.forEach((r, i) => {
    if (r.length !== qw) out.push(`${i}행 길이 ${r.length} ≠ ${qw}`)
  })
  if (out.length) return out

  let parsed
  try {
    parsed = parseMap(m)
  } catch (e) {
    return [e instanceof Error ? e.message : String(e)]
  }
  const { grid, spawns } = parsed

  if (m.bots < 1 || m.bots > 7) out.push(`봇 수 ${m.bots} 는 1~7 이어야 한다`)
  if (spawns.length < m.bots + 1) out.push(`시작점 ${spawns.length}개 < 참가자 ${m.bots + 1}명`)
  if (m.weapons.length === 0) out.push('봇 무기 목록이 비었다')

  for (const [x, y] of spawns) {
    if (!canStand(grid, x, y)) out.push(`시작점 (${x / TILE - 0.5},${y / TILE - 0.5}) 에 설 수 없다`)
  }

  // 모든 시작점이 서로 이어져 있어야 한다 (상자는 부수면 길이 되므로 통과로 본다)
  if (spawns.length > 0) {
    const seen = reachableFrom(grid, spawns[0]![0], spawns[0]![1])
    for (const [x, y] of spawns) {
      const i = Math.floor(y / TILE) * grid.w + Math.floor(x / TILE)
      if (!seen[i]) out.push(`시작점 (${Math.floor(x / TILE)},${Math.floor(y / TILE)}) 이 고립됐다`)
    }
    // 가운데(독안개가 끝까지 남는 곳)에도 닿아야 한다
    const cx = Math.floor(grid.w / 2)
    const cy = Math.floor(grid.h / 2)
    const centerOk = [[cx, cy], [cx - 1, cy], [cx, cy - 1], [cx - 1, cy - 1]]
      .some(([tx, ty]) => seen[ty! * grid.w + tx!])
    if (!centerOk) out.push('맵 가운데에 닿을 수 없다')
  }
  return out
}

export function assertValidArenaMaps(maps: readonly ArenaMap[]): void {
  const ids = new Set<string>()
  for (const m of maps) {
    if (ids.has(m.id)) throw new Error(`숲속대결 맵 id 중복: ${m.id}`)
    ids.add(m.id)
    const p = arenaMapProblems(m)
    if (p.length) throw new Error(`숲속대결 맵 ${m.id} (${m.name}):\n- ${p.join('\n- ')}`)
  }
}
