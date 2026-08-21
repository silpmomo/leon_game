import type { Player } from '../types'
import { VIEW_W } from './tuning'

/** 플레이어 중심을 화면 가로 이 비율 지점에 둔다 */
const ANCHOR = 0.4

export function updateCamera(
  cam: { x: number; y: number },
  p: Player,
  levelW: number,
): void {
  const target = p.x + p.w / 2 - VIEW_W * ANCHOR
  const maxX = Math.max(0, levelW - VIEW_W)
  cam.x = Math.max(0, Math.min(maxX, target))
  cam.y = 0
}
