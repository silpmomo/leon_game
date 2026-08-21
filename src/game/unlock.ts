import type { Progress } from '../types'

/**
 * 스테이지 잠금 규칙.
 *
 * 1탄은 항상 열려 있고, 이전 탄을 깨면 다음 탄이 열린다.
 * 순수 함수로 두어 UI 없이 테스트한다.
 */
export function isUnlocked(stageIds: readonly string[], index: number, progress: Progress): boolean {
  if (index <= 0) return true
  if (index >= stageIds.length) return false
  const prev = stageIds[index - 1]!
  return progress[prev]?.cleared === true
}

/** 열려 있는 가장 뒤쪽 스테이지 인덱스 */
export function furthestUnlocked(stageIds: readonly string[], progress: Progress): number {
  let i = 0
  while (i + 1 < stageIds.length && isUnlocked(stageIds, i + 1, progress)) i += 1
  return i
}

export function clearedCount(stageIds: readonly string[], progress: Progress): number {
  return stageIds.filter((id) => progress[id]?.cleared === true).length
}
