import type { LevelData, TileGrid } from '../types'
import { TILE, derive } from '../engine/tuning'
import { LevelParseError, isDeadly, parseTiles, solidAt, tileAt } from '../world/tilemap'

export type Issue = { rule: number; message: string }

/** 달리기 점프로 넘을 수 있는 최대 구덩이 폭(타일). 상수를 바꾸면 함께 바뀐다. */
export function maxPitWidth(): number {
  return Math.floor(derive().runReach / TILE)
}

/**
 * 맨 아래부터 연속된 solid 스택의 최상단 ty. 바닥이 비어 있으면 null.
 *
 * 땅이 여러 줄이거나 계단·파이프가 솟아 있는 열에서도 "서 있을 수 있는 면"을
 * 찾는다. 맨 아래 한 줄만 보면 1-1처럼 땅이 두 줄인 레벨에서 규칙 5는
 * 아무것도 못 잡고 규칙 6은 모든 체크포인트를 오검출한다.
 */
function floorTopAt(g: TileGrid, tx: number, height: number): number | null {
  if (!solidAt(g, tx, height - 1)) return null
  let ty = height - 1
  while (ty - 1 >= 0 && solidAt(g, tx, ty - 1)) ty -= 1
  return ty
}

export function validateLevel(level: LevelData): Issue[] {
  const issues: Issue[] = []

  // ── 규칙 1: 격자 크기
  if (level.tiles.length !== level.height) {
    issues.push({
      rule: 1,
      message: `행 수 ${level.tiles.length} 가 height ${level.height} 와 다르다`,
    })
  }
  level.tiles.forEach((row, i) => {
    if (row.length !== level.width) {
      issues.push({
        rule: 1,
        message: `${i + 1}행 길이 ${row.length} 가 width ${level.width} 와 다르다`,
      })
    }
  })

  // ── 규칙 2: 미정의 문자 (파서가 던지는 오류를 그대로 쓴다)
  let grid: TileGrid
  try {
    grid = parseTiles(level.tiles).grid
  } catch (e) {
    issues.push({
      rule: 2,
      message: e instanceof LevelParseError ? e.message : String(e),
    })
    return issues // 파싱이 안 되면 이후 검사는 무의미하다
  }

  const g = grid
  const groundRow = level.height - 1

  // ── 규칙 3: spawn
  if (solidAt(g, level.spawn.x, level.spawn.y)) {
    issues.push({
      rule: 3,
      message: `spawn (${level.spawn.x}, ${level.spawn.y}) 이 블록 안이다`,
    })
  }
  if (!solidAt(g, level.spawn.x, level.spawn.y + 1)) {
    issues.push({
      rule: 3,
      message: `spawn (${level.spawn.x}, ${level.spawn.y}) 바로 아래가 땅이 아니다`,
    })
  }

  // ── 규칙 4: 구덩이 폭 (이동발판이 걸친 구간은 제외 — 계획 정정 3)
  const limit = maxPitWidth()
  const reach = Math.round(derive().runReach)
  const platformSpans = level.entities
    .filter((e): e is Extract<typeof e, { type: 'platform' }> => e.type === 'platform')
    .map((e) => [e.x - e.range - 3, e.x + e.range + 3] as const)

  // 용암은 solid 가 아니므로 이미 구덩이로 잡힌다. 발판이 덮으면 예외.
  let pitStart = -1
  for (let tx = 0; tx <= level.width; tx++) {
    const isPit = tx < level.width && !solidAt(g, tx, groundRow)
    if (isPit && pitStart === -1) pitStart = tx
    if (!isPit && pitStart !== -1) {
      const width = tx - pitStart
      const covered = platformSpans.some(([a, b]) => a <= tx && b >= pitStart)
      if (width > limit && !covered) {
        issues.push({
          rule: 4,
          message:
            `타일 ${pitStart}~${tx - 1} 의 구덩이 ${width}타일 은 `
            + `달리기 도달 거리 ${reach}px(${limit}타일)를 초과한다`,
        })
      }
      pitStart = -1
    }
  }

  // ── 규칙 5: 통로 높이 — 서 있을 수 있는 면 위로 열린 칸이 2개 이상
  for (let tx = 0; tx < level.width; tx++) {
    const top = floorTopAt(g, tx, level.height)
    if (top === null) continue // 구덩이 열은 건너뛴다
    let open = 0
    for (let ty = top - 1; ty >= 0; ty--) {
      if (solidAt(g, tx, ty)) break
      open += 1
    }
    if (open === 1) {
      issues.push({ rule: 5, message: `${tx}열의 통로 높이가 1타일이다 (최소 2타일)` })
    }
  }

  // ── 규칙 6: checkpoints
  for (const cp of level.checkpoints) {
    if (cp < 0 || cp >= level.width) {
      issues.push({
        rule: 6,
        message: `체크포인트 ${cp} 가 레벨 범위(0~${level.width - 1}) 밖이다`,
      })
      continue
    }
    const top = floorTopAt(g, cp, level.height)
    // top === 0 은 열이 천장까지 꽉 찬 경우 — 설 자리가 없다.
    // 이 조건이 없으면 top - 1 이 범위 밖(=solid 아님)이 되어 통과해 버린다.
    if (top === null || top === 0 || solidAt(g, cp, top - 1)) {
      issues.push({ rule: 6, message: `체크포인트 ${cp} 가 땅 위의 빈칸이 아니다` })
    }
  }

  // ── 규칙 7: goal
  if (level.goal.x < 0 || level.goal.x >= level.width) {
    issues.push({ rule: 7, message: `goal.x ${level.goal.x} 가 레벨 범위 밖이다` })
  }
  if (level.goal.flagTop < 0 || level.goal.flagTop >= level.height) {
    issues.push({ rule: 7, message: `goal.flagTop ${level.goal.flagTop} 가 격자 밖이다` })
  }

  // ── 규칙 8: 용암은 지면 두 줄을 모두 채워야 한다.
  //    한 줄만 채우면 그 위를 걸어 지나갈 수 있어 위험이 사라진다.
  for (let tx = 0; tx < level.width; tx++) {
    const bottom = isDeadly(tileAt(g, tx, level.height - 1))
    const above = isDeadly(tileAt(g, tx, level.height - 2))
    if (bottom !== above) {
      issues.push({
        rule: 8,
        message: `${tx}열의 용암이 지면 한 줄만 채운다 (두 줄 모두 채워야 한다)`,
      })
    }
  }

  // ── 규칙 9: 가시는 바닥에 붙어 있어야 한다 (공중에 뜬 가시는 보이지 않는 함정)
  for (let tx = 0; tx < level.width; tx++) {
    for (let ty = 0; ty < level.height; ty++) {
      if (tileAt(g, tx, ty) !== '^') continue
      if (!solidAt(g, tx, ty + 1)) {
        issues.push({ rule: 9, message: `가시 (${tx}, ${ty}) 아래가 땅이 아니다` })
      }
    }
  }

  // ── 규칙 10: 오를 수 없는 단차가 없어야 한다.
  //    최고 점프 높이(73px ≈ 4타일)보다 높은 계단은 넘을 방법이 없다.
  //    높이 5타일 파이프가 이 규칙에 걸린다 — 80px 를 올라야 하는데
  //    점프로는 73px 밖에 못 오른다.
  const maxClimb = Math.floor(derive().jumpHeight / TILE)
  let prevTop: number | null = null
  for (let tx = 0; tx < level.width; tx++) {
    const top = floorTopAt(g, tx, level.height)
    if (top !== null && prevTop !== null) {
      const rise = prevTop - top // 위로 갈수록 ty 가 작아진다
      if (rise > maxClimb) {
        issues.push({
          rule: 10,
          message:
            `${tx}열에서 ${rise}타일 단차 — 점프로 오를 수 있는 최대 `
            + `${maxClimb}타일(${Math.round(derive().jumpHeight)}px)을 넘는다`,
        })
      }
    }
    if (top !== null) prevTop = top
  }

  return issues
}

export function assertValidLevel(level: LevelData): void {
  const issues = validateLevel(level)
  if (issues.length === 0) return
  const lines = issues.map((i) => `  규칙 ${i.rule}: ${i.message}`).join('\n')
  throw new Error(`레벨 "${level.name}" 검증 실패 ${issues.length}건\n${lines}`)
}
