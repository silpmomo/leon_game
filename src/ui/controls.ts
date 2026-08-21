import type { PowerState, Rect } from '../types'
import { VIEW_H, VIEW_W } from '../engine/tuning'

export type ButtonId = 'left' | 'right' | 'jump' | 'fire'

export const BUTTON_ALPHA = 0.42

/** 히트박스는 보이는 원보다 이 비율만큼 크다 (스펙 §7.1) */
const HIT_GROW = 0.2

const MOVE_W = Math.round(VIEW_W * 0.11)
const JUMP_W = Math.round(VIEW_W * 0.15)
const FIRE_W = Math.round(VIEW_W * 0.12)
const BOTTOM = Math.round(VIEW_H * 0.06)
const GAP = Math.round(VIEW_W * 0.02)
const EDGE = Math.round(VIEW_W * 0.03)

function square(x: number, size: number): Rect {
  return { x, y: VIEW_H - BOTTOM - size, w: size, h: size }
}

export function buttonRects(power: PowerState): Record<ButtonId, Rect | null> {
  const jumpX = VIEW_W - EDGE - JUMP_W
  return {
    left: square(EDGE, MOVE_W),
    right: square(EDGE + MOVE_W + GAP, MOVE_W),
    jump: square(jumpX, JUMP_W),
    // 발사 버튼은 축구공을 가진 동안만 존재한다 (스펙 §5.3)
    fire: power === 'ball' ? square(jumpX - GAP - FIRE_W, FIRE_W) : null,
  }
}

/** 원형 버튼이므로 원 판정. 반지름을 20% 키운다. */
function insideGrown(r: Rect, px: number, py: number): boolean {
  const cx = r.x + r.w / 2
  const cy = r.y + r.h / 2
  const radius = (r.w / 2) * (1 + HIT_GROW)
  const dx = px - cx
  const dy = py - cy
  return dx * dx + dy * dy <= radius * radius
}

export function hitTest(px: number, py: number, power: PowerState): ButtonId | null {
  const rects = buttonRects(power)
  // 발사 → 점프 → 이동 순서. 겹치는 경우 작은 버튼이 우선한다.
  for (const id of ['fire', 'jump', 'right', 'left'] as const) {
    const r = rects[id]
    if (r && insideGrown(r, px, py)) return id
  }
  return null
}
