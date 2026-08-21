import { VIEW_H, VIEW_W } from '../engine/tuning'

export function isPortrait(): boolean {
  return window.innerHeight > window.innerWidth
}

export function drawRotateOverlay(ctx: CanvasRenderingContext2D): void {
  ctx.fillStyle = 'rgba(11,13,18,.92)'
  ctx.fillRect(0, 0, VIEW_W, VIEW_H)
  ctx.fillStyle = '#fff'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.font = '12px sans-serif'
  ctx.fillText('폰을 옆으로 돌려주세요', VIEW_W / 2, VIEW_H / 2 - 8)
  ctx.font = '20px sans-serif'
  ctx.fillText('📱 ↻', VIEW_W / 2, VIEW_H / 2 + 16)
}
