import type { GameState, Rect } from '../types'
import { VIEW_H, VIEW_W } from '../engine/tuning'
import { CHALLENGE_TIME_MS } from '../game/update'

const BTN_W = 104
const BTN_H = 26
const BTN_Y = Math.round(VIEW_H * 0.72)

export const AGAIN_RECT: Rect = { x: VIEW_W / 2 - BTN_W - 8, y: BTN_Y, w: BTN_W, h: BTN_H }
export const TITLE_RECT: Rect = { x: VIEW_W / 2 + 8, y: BTN_Y, w: BTN_W, h: BTN_H }

function inside(r: Rect, px: number, py: number): boolean {
  return px >= r.x && px <= r.x + r.w && py >= r.y && py <= r.y + r.h
}

export function clearHitTest(px: number, py: number): 'again' | 'title' | null {
  if (inside(AGAIN_RECT, px, py)) return 'again'
  if (inside(TITLE_RECT, px, py)) return 'title'
  return null
}

export function drawClear(ctx: CanvasRenderingContext2D, s: GameState): void {
  ctx.fillStyle = 'rgba(11,13,18,.86)'
  ctx.fillRect(0, 0, VIEW_W, VIEW_H)

  const cleared = s.scene === 'clear'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'alphabetic'
  ctx.fillStyle = cleared ? '#7fd463' : '#e2574c'
  ctx.font = 'bold 18px sans-serif'
  ctx.fillText(cleared ? '클리어!' : '게임 오버', VIEW_W / 2, 44)

  const elapsed = s.mode === 'practice' ? s.timeMs : CHALLENGE_TIME_MS - s.timeMs
  const secs = Math.max(0, Math.round(elapsed / 1000))
  const lines = [
    `점수  ${s.score}`,
    `시간  ${Math.floor(secs / 60)}:${String(secs % 60).padStart(2, '0')}`,
    `죽은 횟수  ${s.deaths}`,
  ]

  ctx.fillStyle = '#fff'
  ctx.font = '10px monospace'
  lines.forEach((t, i) => ctx.fillText(t, VIEW_W / 2, 72 + i * 15))

  const buttons: [Rect, string, string][] = [
    [AGAIN_RECT, '다시 하기', '#4bc0ae'],
    [TITLE_RECT, '처음 화면', '#5a6472'],
  ]
  for (const [r, label, color] of buttons) {
    ctx.fillStyle = color
    ctx.fillRect(r.x, r.y, r.w, r.h)
    ctx.fillStyle = '#fff'
    ctx.font = 'bold 10px sans-serif'
    ctx.fillText(label, r.x + r.w / 2, r.y + 17)
  }
}
