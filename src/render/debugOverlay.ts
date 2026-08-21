import type { GameState, Rect } from '../types'
import { TILE, VIEW_H, VIEW_W } from '../engine/tuning'
import { solidAt } from '../world/tilemap'

export function drawDebug(ctx: CanvasRenderingContext2D, s: GameState): void {
  ctx.save()
  ctx.translate(-Math.round(s.camera.x), -Math.round(s.camera.y))

  // 타일 격자 + solid 표시
  const tx0 = Math.max(0, Math.floor(s.camera.x / TILE))
  const tx1 = Math.min(s.grid.w - 1, Math.ceil((s.camera.x + VIEW_W) / TILE))
  ctx.lineWidth = 0.5
  for (let tx = tx0; tx <= tx1; tx++) {
    for (let ty = 0; ty < s.grid.h; ty++) {
      ctx.strokeStyle = solidAt(s.grid, tx, ty)
        ? 'rgba(255,0,0,.5)'
        : 'rgba(255,255,255,.14)'
      ctx.strokeRect(tx * TILE + 0.25, ty * TILE + 0.25, TILE - 0.5, TILE - 0.5)
    }
  }

  // 히트박스
  const boxes: [Rect, string][] = [
    [s.player, '#00ff88'],
    ...s.enemies.map((e) => [e, '#ff4466'] as [Rect, string]),
    ...s.platforms.map((p) => [p, '#ffcc00'] as [Rect, string]),
    ...s.balls.map((b) => [b, '#ffffff'] as [Rect, string]),
    ...s.items.map((i) => [i, '#66ccff'] as [Rect, string]),
    ...s.coins.map((c) => [c, '#e8b52a'] as [Rect, string]),
  ]
  ctx.lineWidth = 1
  for (const [b, color] of boxes) {
    ctx.strokeStyle = color
    ctx.strokeRect(Math.round(b.x) + 0.5, Math.round(b.y) + 0.5, b.w - 1, b.h - 1)
  }

  // 속도 벡터
  const p = s.player
  ctx.strokeStyle = '#00ff88'
  ctx.beginPath()
  ctx.moveTo(p.x + p.w / 2, p.y + p.h / 2)
  ctx.lineTo(p.x + p.w / 2 + p.vx / 4, p.y + p.h / 2 + p.vy / 4)
  ctx.stroke()

  // 체크포인트 표시
  ctx.strokeStyle = '#ffa500'
  for (const cp of s.level.checkpoints) {
    ctx.beginPath()
    ctx.moveTo(cp * TILE, 0)
    ctx.lineTo(cp * TILE, s.level.height * TILE)
    ctx.stroke()
  }

  ctx.restore()

  // 수치
  ctx.fillStyle = 'rgba(0,0,0,.65)'
  ctx.fillRect(0, VIEW_H - 34, 168, 34)
  ctx.fillStyle = '#0f8'
  ctx.font = '6px monospace'
  ctx.textAlign = 'left'
  ctx.textBaseline = 'top'
  const tx = Math.floor((p.x + p.w / 2) / TILE)
  ctx.fillText(
    `tile ${tx}  vx ${p.vx.toFixed(1)}  vy ${p.vy.toFixed(1)}`,
    4,
    VIEW_H - 31,
  )
  ctx.fillText(
    `ground ${p.onGround ? 1 : 0}  run ${p.runMs.toFixed(0)}  coyote ${p.coyoteMs.toFixed(0)}`,
    4,
    VIEW_H - 23,
  )
  ctx.fillText(
    `power ${p.power}  enemies ${s.enemies.length}  cp ${s.checkpointX}`,
    4,
    VIEW_H - 15,
  )
  ctx.restore()
}
