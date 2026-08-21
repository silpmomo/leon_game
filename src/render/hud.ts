import type { GameState } from '../types'
import { VIEW_W } from '../engine/tuning'

/** 우상단 음소거 토글 영역 */
export const MUTE_RECT = { x: VIEW_W - 26, y: 15, w: 22, h: 14 }

function fmtTime(ms: number): string {
  const total = Math.max(0, Math.ceil(ms / 1000))
  const m = Math.floor(total / 60)
  const sec = total % 60
  return `${m}:${String(sec).padStart(2, '0')}`
}

export function drawHud(ctx: CanvasRenderingContext2D, s: GameState): void {
  ctx.save()
  ctx.font = 'bold 8px monospace'
  ctx.textBaseline = 'top'
  ctx.lineWidth = 2.5
  ctx.strokeStyle = 'rgba(255,255,255,.85)'
  ctx.fillStyle = '#1b2430'

  const line = (text: string, x: number, align: CanvasTextAlign, y = 6): void => {
    ctx.textAlign = align
    ctx.strokeText(text, x, y)
    ctx.fillText(text, x, y)
  }

  line(`● ${String(s.coinCount).padStart(2, '0')}`, 8, 'left')
  line(`${s.score}`, Math.round(VIEW_W * 0.3), 'left')
  line(`⏱ ${fmtTime(s.timeMs)}`, VIEW_W / 2, 'center')
  line(
    s.mode === 'challenge' ? `♥ ${s.lives}` : `죽음 ${s.deaths}`,
    VIEW_W - 8,
    'right',
  )

  // 음소거 표시
  ctx.font = '9px sans-serif'
  line(s.muted ? '🔇' : '🔊', VIEW_W - 8, 'right', 17)

  ctx.restore()
}
