import type { Rect } from '../types'
import { VIEW_H, VIEW_W } from '../engine/tuning'

/**
 * 하늘전투 조작 UI.
 *
 * 버튼은 궁극기 하나뿐이다. 자리와 크기를 기존 게임의 점프 버튼과 똑같이
 * 맞춰 아이가 손을 새로 익히지 않아도 되게 했다.
 */

/**
 * 기존 게임 점프 버튼(0.15)보다 작다. 보스가 화면 오른쪽에 자리잡는
 * 슈팅이라 큰 버튼이 보스를 통째로 가렸다. 손가락이 닿는 판정은
 * HIT_GROW 로 넉넉히 남긴다.
 */
const SIZE = Math.round(VIEW_W * 0.115)
const BOTTOM = Math.round(VIEW_H * 0.02)
const EDGE = Math.round(VIEW_W * 0.015)
const HIT_GROW = 0.25

export const BOMB_RECT: Rect = {
  x: VIEW_W - EDGE - SIZE,
  y: VIEW_H - BOTTOM - SIZE,
  w: SIZE,
  h: SIZE,
}

export function bombHitTest(px: number, py: number): boolean {
  const cx = BOMB_RECT.x + BOMB_RECT.w / 2
  const cy = BOMB_RECT.y + BOMB_RECT.h / 2
  const r = (BOMB_RECT.w / 2) * (1 + HIT_GROW)
  return (px - cx) ** 2 + (py - cy) ** 2 <= r * r
}

/** 궁극기 버튼. 남은 개수가 0이면 흐려진다 */
export function drawSkyControls(
  ctx: CanvasRenderingContext2D,
  bombs: number,
  tick: number,
): void {
  const cx = BOMB_RECT.x + BOMB_RECT.w / 2
  const cy = BOMB_RECT.y + BOMB_RECT.h / 2
  const r = BOMB_RECT.w / 2
  const ready = bombs > 0

  ctx.save()
  ctx.globalAlpha = ready ? 0.38 : 0.18
  ctx.fillStyle = ready ? '#3c6fa8' : '#4a4a52'
  ctx.beginPath()
  ctx.arc(cx, cy, r, 0, Math.PI * 2)
  ctx.fill()
  ctx.lineWidth = 2
  ctx.strokeStyle = ready ? '#ffd166' : '#7a7a84'
  ctx.stroke()

  // 번개 아이콘 — 궁극기가 100만볼트라서 아이콘도 번개다
  ctx.globalAlpha = ready ? 0.95 : 0.4
  ctx.fillStyle = ready ? '#ffe066' : '#9a9aa4'
  ctx.beginPath()
  ctx.moveTo(cx + 3, cy - r * 0.55)
  ctx.lineTo(cx - 5, cy + 1)
  ctx.lineTo(cx - 1, cy + 1)
  ctx.lineTo(cx - 3, cy + r * 0.55)
  ctx.lineTo(cx + 6, cy - 2)
  ctx.lineTo(cx + 1, cy - 2)
  ctx.closePath()
  ctx.fill()

  if (ready) {
    // 남은 개수를 테두리 눈금으로 보여준다
    ctx.globalAlpha = 0.9
    ctx.strokeStyle = '#ffe066'
    ctx.lineWidth = 2
    ctx.beginPath()
    ctx.arc(cx, cy, r - 3, -Math.PI / 2, -Math.PI / 2 + (bombs / 6) * Math.PI * 2)
    ctx.stroke()
    if (bombs >= 6 && Math.floor(tick / 8) % 2 === 0) {
      ctx.globalAlpha = 0.35
      ctx.fillStyle = '#ffffff'
      ctx.beginPath()
      ctx.arc(cx, cy, r, 0, Math.PI * 2)
      ctx.fill()
    }
  }
  ctx.restore()
}
