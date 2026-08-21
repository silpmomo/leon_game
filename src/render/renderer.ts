import type { GameState, PowerState, Tile } from '../types'
import { TILE, VIEW_H, VIEW_W } from '../engine/tuning'
import { tileAt } from '../world/tilemap'
import { BUTTON_ALPHA, buttonRects } from '../ui/controls'

const TILE_COLOR: Partial<Record<Tile, string>> = {
  '#': '#a85c30',
  B: '#8f4d24',
  b: '#8f4d24',
  '?': '#f2b134',
  '@': '#f28f5c',
  '*': '#eddb6a',
  H: '#9aa3ad',
  p: '#3fae52',
  '|': '#2e8b3e',
}

export function drawWorld(ctx: CanvasRenderingContext2D, s: GameState): void {
  // 하늘
  const sky = ctx.createLinearGradient(0, 0, 0, VIEW_H)
  sky.addColorStop(0, '#8ed0f2')
  sky.addColorStop(0.78, '#bfe4f7')
  sky.addColorStop(1, '#dcf0f9')
  ctx.fillStyle = sky
  ctx.fillRect(0, 0, VIEW_W, VIEW_H)

  ctx.save()
  ctx.translate(-Math.round(s.camera.x), -Math.round(s.camera.y))

  // 화면에 걸치는 타일 열만 순회한다
  const tx0 = Math.max(0, Math.floor(s.camera.x / TILE))
  const tx1 = Math.min(s.grid.w - 1, Math.ceil((s.camera.x + VIEW_W) / TILE))

  for (let tx = tx0; tx <= tx1; tx++) {
    for (let ty = 0; ty < s.grid.h; ty++) {
      const color = TILE_COLOR[tileAt(s.grid, tx, ty)]
      if (!color) continue
      ctx.fillStyle = color
      ctx.fillRect(tx * TILE, ty * TILE, TILE, TILE)
      ctx.strokeStyle = 'rgba(0,0,0,.18)'
      ctx.strokeRect(tx * TILE + 0.5, ty * TILE + 0.5, TILE - 1, TILE - 1)
    }
  }

  // 코인
  ctx.fillStyle = '#e8b52a'
  for (const c of s.coins) {
    if (c.taken) continue
    ctx.fillRect(c.x, c.y, c.w, c.h)
  }

  // 아이템
  for (const it of s.items) {
    if (it.taken) continue
    ctx.fillStyle = it.kind === 'peach' ? '#f2795c' : '#ffffff'
    ctx.fillRect(Math.round(it.x), Math.round(it.y), it.w, it.h)
  }

  // 이동발판
  ctx.fillStyle = '#d8b06a'
  for (const pf of s.platforms) {
    ctx.fillRect(Math.round(pf.x), Math.round(pf.y), pf.w, pf.h)
  }

  // 적
  const ENEMY_COLOR = { broccoli: '#3f8f4e', soup: '#24402c', crocodile: '#4f8a3b' }
  for (const e of s.enemies) {
    if (!e.alive) continue
    ctx.fillStyle = e.squashMs > 0 ? '#6b6b6b' : ENEMY_COLOR[e.kind]
    const h = e.squashMs > 0 ? Math.max(3, e.h / 3) : e.h
    ctx.fillRect(Math.round(e.x), Math.round(e.y + e.h - h), e.w, h)
  }

  // 축구공
  ctx.fillStyle = '#ffffff'
  for (const b of s.balls) {
    if (!b.alive) continue
    ctx.fillRect(Math.round(b.x), Math.round(b.y), b.w, b.h)
  }

  // 플레이어 — 스프라이트 전이라 얼굴 자리 + 몸통을 사각형으로 그린다
  const p = s.player
  const blink = p.invulnMs > 0 && Math.floor(p.invulnMs / 80) % 2 === 0
  if (!blink) {
    const headH = Math.round(p.h * 0.45)
    ctx.fillStyle = '#14110f' // 흑발
    ctx.fillRect(Math.round(p.x), Math.round(p.y) - 2, p.w, 3)
    ctx.fillStyle = '#f0c9a4' // 얼굴
    ctx.fillRect(Math.round(p.x), Math.round(p.y), p.w, headH)
    ctx.fillStyle = '#4bc0ae' // 민트 저지
    ctx.fillRect(Math.round(p.x), Math.round(p.y) + headH, p.w, p.h - headH - 4)
    ctx.fillStyle = '#ece3cf' // 아이보리 반바지
    ctx.fillRect(Math.round(p.x), Math.round(p.y) + p.h - 4, p.w, 4)
  }

  // 깃대
  const goalX = s.level.goal.x * TILE
  ctx.fillStyle = '#4a4a4a'
  ctx.fillRect(goalX, s.level.goal.flagTop * TILE, 2, (s.level.height - 2 - s.level.goal.flagTop) * TILE)
  ctx.fillStyle = '#e0453c'
  ctx.fillRect(goalX + 2, s.level.goal.flagTop * TILE + 2, 10, 7)

  ctx.restore()
}

export function drawControls(ctx: CanvasRenderingContext2D, power: PowerState): void {
  const rects = buttonRects(power)
  const labels: Record<string, string> = { left: '◀', right: '▶', jump: '⬆', fire: '⚽' }

  ctx.save()
  for (const [id, r] of Object.entries(rects)) {
    if (!r) continue
    const cx = r.x + r.w / 2
    const cy = r.y + r.h / 2

    ctx.globalAlpha = BUTTON_ALPHA
    ctx.beginPath()
    ctx.arc(cx, cy, r.w / 2, 0, Math.PI * 2)
    ctx.fillStyle = id === 'jump' ? 'rgba(226,68,68,.85)' : 'rgba(24,28,36,.85)'
    ctx.fill()
    ctx.lineWidth = 2
    ctx.strokeStyle = 'rgba(255,255,255,.7)'
    ctx.stroke()

    ctx.globalAlpha = 1
    ctx.fillStyle = '#fff'
    ctx.font = '9px sans-serif'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText(labels[id] ?? '', cx, cy)
  }
  ctx.restore()
}
