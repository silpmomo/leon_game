import type { Mode, Progress, Rect } from '../types'
import { VIEW_H, VIEW_W } from '../engine/tuning'

const BTN_W = 110
const BTN_H = 30
const GAP = 14

function rects(): Record<Mode, Rect> {
  const y = Math.round(VIEW_H * 0.56)
  const totalW = BTN_W * 2 + GAP
  const x0 = Math.round((VIEW_W - totalW) / 2)
  return {
    practice: { x: x0, y, w: BTN_W, h: BTN_H },
    challenge: { x: x0 + BTN_W + GAP, y, w: BTN_W, h: BTN_H },
  }
}

export function titleHitTest(px: number, py: number): Mode | null {
  const r = rects()
  for (const mode of ['practice', 'challenge'] as Mode[]) {
    const b = r[mode]
    if (px >= b.x && px <= b.x + b.w && py >= b.y && py <= b.y + b.h) return mode
  }
  return null
}

const LABELS: Record<Mode, [string, string]> = {
  practice: ['연습', '체크포인트 부활'],
  challenge: ['도전', '목숨 3개 · 400초'],
}

export function drawTitle(
  ctx: CanvasRenderingContext2D,
  progress: Record<Mode, Progress>,
  totalStages: number,
): void {
  const sky = ctx.createLinearGradient(0, 0, 0, VIEW_H)
  sky.addColorStop(0, '#2b4a6f')
  sky.addColorStop(1, '#6fa8cf')
  ctx.fillStyle = sky
  ctx.fillRect(0, 0, VIEW_W, VIEW_H)

  ctx.textAlign = 'center'
  ctx.textBaseline = 'alphabetic'
  ctx.fillStyle = '#fff'
  ctx.font = 'bold 20px sans-serif'
  ctx.fillText('리온의 대모험', VIEW_W / 2, 46)
  ctx.font = '9px sans-serif'
  ctx.fillStyle = 'rgba(255,255,255,.8)'
  ctx.fillText('전 10탄', VIEW_W / 2, 62)

  const r = rects()
  for (const mode of ['practice', 'challenge'] as Mode[]) {
    const b = r[mode]
    ctx.fillStyle = mode === 'practice' ? '#4bc0ae' : '#e2574c'
    ctx.fillRect(b.x, b.y, b.w, b.h)
    ctx.strokeStyle = 'rgba(255,255,255,.85)'
    ctx.lineWidth = 2
    ctx.strokeRect(b.x + 1, b.y + 1, b.w - 2, b.h - 2)

    ctx.fillStyle = '#fff'
    ctx.font = 'bold 11px sans-serif'
    ctx.fillText(LABELS[mode][0], b.x + b.w / 2, b.y + 15)
    ctx.font = '7px sans-serif'
    ctx.fillText(LABELS[mode][1], b.x + b.w / 2, b.y + 25)

    const cleared = Object.values(progress[mode]).filter((r) => r.cleared).length
    ctx.fillStyle = 'rgba(255,255,255,.75)'
    ctx.font = '7px monospace'
    ctx.fillText(`${cleared} / ${totalStages} 탄 클리어`, b.x + b.w / 2, b.y + b.h + 12)
  }

  ctx.fillStyle = 'rgba(255,255,255,.6)'
  ctx.font = '7px sans-serif'
  ctx.fillText('가로로 들고 아래 버튼으로 조작하세요', VIEW_W / 2, VIEW_H - 8)
}
