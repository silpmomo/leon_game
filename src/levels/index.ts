import type { LevelData } from '../types'
import s01 from './stage-01.json'
import s02 from './stage-02.json'
import s03 from './stage-03.json'
import s04 from './stage-04.json'
import s05 from './stage-05.json'
import s06 from './stage-06.json'
import s07 from './stage-07.json'
import s08 from './stage-08.json'
import s09 from './stage-09.json'
import s10 from './stage-10.json'

/** 1탄 → 10탄 순서. 인덱스 0 이 1탄이다. */
export const STAGES: readonly LevelData[] = [
  s01, s02, s03, s04, s05, s06, s07, s08, s09, s10,
] as LevelData[]

export function stageAt(i: number): LevelData {
  return STAGES[Math.max(0, Math.min(STAGES.length - 1, i))]!
}

export function stageIndexById(id: string): number {
  const i = STAGES.findIndex((s) => s.id === id)
  return i < 0 ? 0 : i
}
