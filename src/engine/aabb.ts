import type { Rect } from '../types'

export function overlapX(a: Rect, b: Rect): number {
  return Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x)
}

export function overlapY(a: Rect, b: Rect): number {
  return Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y)
}

export function overlaps(a: Rect, b: Rect): boolean {
  return overlapX(a, b) > 0 && overlapY(a, b) > 0
}
