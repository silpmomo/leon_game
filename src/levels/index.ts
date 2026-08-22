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
import s11 from './stage-11.json'
import s12 from './stage-12.json'
import s13 from './stage-13.json'
import s14 from './stage-14.json'
import s15 from './stage-15.json'
import s16 from './stage-16.json'
import s17 from './stage-17.json'
import s18 from './stage-18.json'
import s19 from './stage-19.json'
import s20 from './stage-20.json'
import s21 from './stage-21.json'
import s22 from './stage-22.json'
import s23 from './stage-23.json'
import s24 from './stage-24.json'
import s25 from './stage-25.json'
import s26 from './stage-26.json'
import s27 from './stage-27.json'
import s28 from './stage-28.json'
import s29 from './stage-29.json'
import s30 from './stage-30.json'

/** 한 월드에 들어가는 탄 수 */
export const STAGES_PER_WORLD = 10

/** 1-1 → 3-10 순서. 인덱스 0 이 1-1 이다. */
export const STAGES: readonly LevelData[] = [
  s01, s02, s03, s04, s05, s06, s07, s08, s09, s10,
  s11, s12, s13, s14, s15, s16, s17, s18, s19, s20,
  s21, s22, s23, s24, s25, s26, s27, s28, s29, s30,
] as LevelData[]

export const WORLD_COUNT = Math.ceil(STAGES.length / STAGES_PER_WORLD)

export function stageAt(i: number): LevelData {
  return STAGES[Math.max(0, Math.min(STAGES.length - 1, i))]!
}

export function stageIndexById(id: string): number {
  const i = STAGES.findIndex((s) => s.id === id)
  return i < 0 ? 0 : i
}

/** 인덱스가 속한 월드 (0부터) */
export function worldOf(index: number): number {
  return Math.floor(index / STAGES_PER_WORLD)
}

/** 해당 월드의 탄 목록 */
export function stagesOfWorld(world: number): readonly LevelData[] {
  const start = world * STAGES_PER_WORLD
  return STAGES.slice(start, start + STAGES_PER_WORLD)
}
