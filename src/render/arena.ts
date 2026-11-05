import type { ArenaState, Fighter, Skin } from '../arena/types'
import { VIEW_H, VIEW_W } from '../engine/tuning'
import { MAX_AMMO, canSee, gasProgress, safeRect } from '../arena/combat'
import { inBush } from '../arena/grid'
import { playerRank } from '../arena/scenes'
import { TILE, WORLD_H, WORLD_W } from '../arena/tuning'
import { frame, type LoadedAtlas } from './atlas'

/**
 * 숲속대결 그리기. 타일·수풀·안개는 코드로, 캐릭터는 아틀라스 프레임으로.
 */

type Palette = {
  grass: string; grass2: string; rock: string; rockTop: string
  water: string; bush: string; bushDark: string
}

const THEMES: Record<ArenaState['map']['theme'], Palette> = {
  meadow: { grass: '#7cc45a', grass2: '#74bb53', rock: '#8a7a68', rockTop: '#a8977f', water: '#3f8fd8', bush: '#2f8f3a', bushDark: '#22702c' },
  lake: { grass: '#86c86a', grass2: '#7dbf61', rock: '#7d7f86', rockTop: '#9c9ea6', water: '#3a86d0', bush: '#2e8a48', bushDark: '#216b37' },
  rock: { grass: '#a9b46a', grass2: '#9fab61', rock: '#7a6a5c', rockTop: '#97857a', water: '#4a8ac0', bush: '#4a8a34', bushDark: '#386b27' },
  mushroom: { grass: '#6fb86a', grass2: '#67ae62', rock: '#b06a7a', rockTop: '#cc8898', water: '#4a7ad8', bush: '#3a7a5a', bushDark: '#2b5e44' },
  river: { grass: '#8ccf62', grass2: '#83c55a', rock: '#857565', rockTop: '#a2917f', water: '#3393dc', bush: '#2f8f3a', bushDark: '#22702c' },
  royal: { grass: '#6aa85a', grass2: '#629f53', rock: '#6a6a8a', rockTop: '#8888aa', water: '#4a6ad0', bush: '#2a7a3a', bushDark: '#1f5e2c' },
}

/** 봇 그림 — 대모험 적 프레임 2장을 번갈아 */
const SKIN_FRAMES: Record<Skin, [string, string]> = {
  leon: ['face', 'face'],
  broccoli: ['broccoli0', 'broccoli1'],
  crocodile: ['crocodile0', 'crocodile1'],
  soup: ['soupCrouch', 'soupJump'],
  spiky: ['spiky0', 'spiky1'],
  flyer: ['flyer0', 'flyer1'],
  thrower: ['thrower0', 'thrower1'],
}

const SKIN_COLOR: Record<Skin, string> = {
  leon: '#4bc0ae', broccoli: '#5fb83a', crocodile: '#3f9a5a', soup: '#e0a040',
  spiky: '#8a6ad0', flyer: '#d05a8a', thrower: '#c0703a',
}

export type Camera = { x: number; y: number }

export function arenaCamera(s: ArenaState): Camera {
  const p = s.fighters[0]!
  return {
    x: Math.round(Math.max(0, Math.min(WORLD_W - VIEW_W, p.x - VIEW_W / 2))),
    y: Math.round(Math.max(0, Math.min(WORLD_H - VIEW_H, p.y - VIEW_H / 2))),
  }
}

function drawTiles(ctx: CanvasRenderingContext2D, s: ArenaState, cam: Camera, tick: number): void {
  const pal = THEMES[s.map.theme]
  const g = s.grid
  const x0 = Math.floor(cam.x / TILE)
  const y0 = Math.floor(cam.y / TILE)
  const x1 = Math.min(g.w - 1, Math.floor((cam.x + VIEW_W) / TILE))
  const y1 = Math.min(g.h - 1, Math.floor((cam.y + VIEW_H) / TILE))

  for (let ty = y0; ty <= y1; ty++) {
    for (let tx = x0; tx <= x1; tx++) {
      const t = g.cells[ty * g.w + tx]!
      const px = tx * TILE - cam.x
      const py = ty * TILE - cam.y
      ctx.fillStyle = (tx + ty) % 2 === 0 ? pal.grass : pal.grass2
      ctx.fillRect(px, py, TILE, TILE)

      if (t === 'w') {
        ctx.fillStyle = pal.water
        ctx.fillRect(px, py, TILE, TILE)
        ctx.fillStyle = 'rgba(255,255,255,.28)'
        const wy = py + 3 + ((tick / 10 + tx * 3) % 6)
        ctx.fillRect(px + 2, Math.floor(wy), 5, 1)
      } else if (t === '#') {
        ctx.fillStyle = pal.rock
        ctx.fillRect(px, py, TILE, TILE)
        ctx.fillStyle = pal.rockTop
        ctx.fillRect(px, py, TILE, 4)
        ctx.fillStyle = 'rgba(0,0,0,.18)'
        ctx.fillRect(px, py + TILE - 2, TILE, 2)
      } else if (t === 'x') {
        ctx.fillStyle = '#b5773e'
        ctx.fillRect(px + 1, py + 1, TILE - 2, TILE - 2)
        ctx.fillStyle = '#8a5428'
        ctx.fillRect(px + 1, py + 5, TILE - 2, 2)
        ctx.fillRect(px + 5, py + 1, 2, TILE - 2)
        ctx.strokeStyle = '#5e3818'
        ctx.lineWidth = 1
        ctx.strokeRect(px + 1.5, py + 1.5, TILE - 3, TILE - 3)
        // 별이 들어 있다는 표시
        ctx.fillStyle = '#ffe066'
        ctx.fillRect(px + 5, py + 5, 2, 2)
      }
    }
  }
}

function drawBushes(ctx: CanvasRenderingContext2D, s: ArenaState, cam: Camera): void {
  const pal = THEMES[s.map.theme]
  const g = s.grid
  const p = s.fighters[0]!
  const x0 = Math.floor(cam.x / TILE)
  const y0 = Math.floor(cam.y / TILE)
  const x1 = Math.min(g.w - 1, Math.floor((cam.x + VIEW_W) / TILE))
  const y1 = Math.min(g.h - 1, Math.floor((cam.y + VIEW_H) / TILE))
  for (let ty = y0; ty <= y1; ty++) {
    for (let tx = x0; tx <= x1; tx++) {
      if (g.cells[ty * g.w + tx] !== '"') continue
      const cx = (tx + 0.5) * TILE
      const cy = (ty + 0.5) * TILE
      // 리온 곁의 수풀은 비쳐 보여야 자기가 어디 있는지 안다
      const near = p.alive && Math.hypot(cx - p.x, cy - p.y) < TILE * 2
      ctx.globalAlpha = near ? 0.45 : 1
      const px = tx * TILE - cam.x
      const py = ty * TILE - cam.y
      ctx.fillStyle = pal.bushDark
      ctx.fillRect(px, py + 2, TILE, TILE - 2)
      ctx.fillStyle = pal.bush
      ctx.beginPath()
      ctx.arc(px + 3, py + 5, 4, 0, Math.PI * 2)
      ctx.arc(px + 9, py + 5, 4, 0, Math.PI * 2)
      ctx.arc(px + 6, py + 8, 4, 0, Math.PI * 2)
      ctx.fill()
    }
  }
  ctx.globalAlpha = 1
}

function drawGems(ctx: CanvasRenderingContext2D, s: ArenaState, cam: Camera): void {
  for (const g of s.gems) {
    const x = Math.round(g.x - cam.x)
    const y = Math.round(g.y - cam.y + Math.sin(g.bobMs / 160) * 1.5)
    if (x < -8 || y < -8 || x > VIEW_W + 8 || y > VIEW_H + 8) continue
    star(ctx, x, y, 4, '#ffe066', '#c08a00')
  }
}

function star(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, fill: string, edge: string): void {
  ctx.beginPath()
  for (let i = 0; i < 10; i++) {
    const a = -Math.PI / 2 + (i * Math.PI) / 5
    const rr = i % 2 === 0 ? r : r * 0.45
    ctx.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr)
  }
  ctx.closePath()
  ctx.fillStyle = fill
  ctx.fill()
  ctx.strokeStyle = edge
  ctx.lineWidth = 1
  ctx.stroke()
}

function drawFighter(
  ctx: CanvasRenderingContext2D, s: ArenaState, f: Fighter, atlas: LoadedAtlas,
  cam: Camera, tick: number,
): void {
  const x = Math.round(f.x - cam.x)
  const y = Math.round(f.y - cam.y)
  if (x < -20 || y < -24 || x > VIEW_W + 20 || y > VIEW_H + 24) return

  const hidden = inBush(s.grid, f.x, f.y) && f.revealMs <= 0
  ctx.save()
  if (hidden) ctx.globalAlpha = 0.55

  // 그림자
  ctx.fillStyle = 'rgba(0,0,0,.25)'
  ctx.beginPath()
  ctx.ellipse(x, y + 5, 6, 2.5, 0, 0, Math.PI * 2)
  ctx.fill()

  // 몸
  const names = SKIN_FRAMES[f.skin]
  const fr = atlas.image ? frame(atlas.data, names[Math.floor(tick / 12) % 2]!) : null
  if (fr && atlas.image) {
    const h = f.isPlayer ? 13 : 14
    const w = Math.round((fr.w / fr.h) * h)
    ctx.drawImage(atlas.image, fr.x, fr.y, fr.w, fr.h, x - Math.round(w / 2), y + 5 - h, w, h)
  } else {
    ctx.fillStyle = SKIN_COLOR[f.skin]
    ctx.beginPath()
    ctx.arc(x, y - 1, 6, 0, Math.PI * 2)
    ctx.fill()
  }
  // 맞으면 번쩍 — canvas filter 는 iOS Safari 에서 안 먹으므로 덧칠로 한다
  if (f.hurtMs > 0) {
    ctx.fillStyle = 'rgba(255,255,255,.55)'
    ctx.beginPath()
    ctx.arc(x, y - 2, 7, 0, Math.PI * 2)
    ctx.fill()
  }

  // 리온 표시 — 수풀이 많은 판에서 자기를 잃어버리지 않게
  if (f.isPlayer) {
    ctx.strokeStyle = '#4bc0ae'
    ctx.lineWidth = 1
    ctx.beginPath()
    ctx.ellipse(x, y + 5, 7, 3, 0, 0, Math.PI * 2)
    ctx.stroke()
  }
  ctx.restore()

  // 체력 막대
  const bw = 18
  const r = f.hp / f.maxHp
  ctx.fillStyle = 'rgba(0,0,0,.55)'
  ctx.fillRect(x - bw / 2 - 1, y - 15, bw + 2, 4)
  ctx.fillStyle = f.isPlayer ? '#5fe07a' : '#ff5a5a'
  ctx.fillRect(x - bw / 2, y - 14, Math.max(0, Math.round(bw * r)), 2)

  if (f.gems > 0) {
    ctx.font = 'bold 6px sans-serif'
    ctx.textAlign = 'left'
    ctx.textBaseline = 'middle'
    ctx.fillStyle = '#ffe066'
    ctx.fillText(`★${f.gems}`, x + bw / 2 + 2, y - 13)
  }

  // 탄창 — 리온 발밑
  if (f.isPlayer) {
    for (let i = 0; i < MAX_AMMO; i++) {
      const fill = Math.max(0, Math.min(1, f.ammo - i))
      ctx.fillStyle = 'rgba(0,0,0,.5)'
      ctx.fillRect(x - 9 + i * 6, y + 8, 5, 2)
      ctx.fillStyle = fill >= 1 ? '#ffb04a' : '#b07a3a'
      ctx.fillRect(x - 9 + i * 6, y + 8, Math.round(5 * fill), 2)
    }
  }
}

function drawBullets(ctx: CanvasRenderingContext2D, s: ArenaState, cam: Camera): void {
  for (const b of s.bullets) {
    const x = b.x - cam.x
    const y = b.y - cam.y
    if (x < -4 || y < -4 || x > VIEW_W + 4 || y > VIEW_H + 4) continue
    const r = b.big ? 3 : 2
    ctx.fillStyle = 'rgba(0,0,0,.5)'
    ctx.beginPath()
    ctx.arc(x, y, r + 1, 0, Math.PI * 2)
    ctx.fill()
    ctx.fillStyle = b.color
    ctx.beginPath()
    ctx.arc(x, y, r, 0, Math.PI * 2)
    ctx.fill()
    if (b.owner === 0) {
      ctx.fillStyle = '#ffffff'
      ctx.fillRect(Math.round(x) - 1, Math.round(y) - 1, 1, 1)
    }
  }
}

function drawGas(ctx: CanvasRenderingContext2D, s: ArenaState, cam: Camera, tick: number): void {
  if (gasProgress(s.t) <= 0) return
  const r = safeRect(s.t)
  const x0 = r.x0 - cam.x
  const y0 = r.y0 - cam.y
  const x1 = r.x1 - cam.x
  const y1 = r.y1 - cam.y
  ctx.fillStyle = `rgba(110,50,160,${0.42 + Math.sin(tick / 15) * 0.05})`
  ctx.fillRect(0, 0, VIEW_W, Math.max(0, y0))
  ctx.fillRect(0, y1, VIEW_W, VIEW_H - y1)
  ctx.fillRect(0, Math.max(0, y0), Math.max(0, x0), Math.max(0, y1 - Math.max(0, y0)))
  ctx.fillRect(x1, Math.max(0, y0), VIEW_W - x1, Math.max(0, y1 - Math.max(0, y0)))
  ctx.strokeStyle = 'rgba(210,150,255,.8)'
  ctx.lineWidth = 1
  ctx.setLineDash([4, 3])
  ctx.strokeRect(x0 + 0.5, y0 + 0.5, x1 - x0 - 1, y1 - y0 - 1)
  ctx.setLineDash([])
}

function drawBursts(ctx: CanvasRenderingContext2D, s: ArenaState, cam: Camera): void {
  for (const b of s.bursts) {
    const k = 1 - b.ms / 500
    ctx.strokeStyle = b.color
    ctx.globalAlpha = Math.max(0, b.ms / 500)
    ctx.lineWidth = 2
    ctx.beginPath()
    ctx.arc(b.x - cam.x, b.y - cam.y, 4 + k * 18, 0, Math.PI * 2)
    ctx.stroke()
  }
  ctx.globalAlpha = 1
}

export function drawArenaWorld(
  ctx: CanvasRenderingContext2D, s: ArenaState, atlas: LoadedAtlas, tick: number,
): void {
  const cam = arenaCamera(s)
  ctx.fillStyle = '#20301c'
  ctx.fillRect(0, 0, VIEW_W, VIEW_H)
  drawTiles(ctx, s, cam, tick)
  drawGems(ctx, s, cam)
  const p = s.fighters[0]!
  // 리온을 맨 위에 그린다
  for (const f of s.fighters) {
    if (!f.alive || f.isPlayer) continue
    if (!canSee(s, p, f)) continue
    drawFighter(ctx, s, f, atlas, cam, tick)
  }
  if (p.alive) drawFighter(ctx, s, p, atlas, cam, tick)
  drawBullets(ctx, s, cam)
  drawBushes(ctx, s, cam)
  drawGas(ctx, s, cam, tick)
  drawBursts(ctx, s, cam)
}

// ── HUD ───────────────────────────────────────────────────────

export const EXIT_RECT = { x: 6, y: 6, w: 18, h: 15 }

function shadowText(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, color: string): void {
  ctx.fillStyle = 'rgba(0,0,0,.55)'
  ctx.fillText(text, x + 1, y + 1)
  ctx.fillStyle = color
  ctx.fillText(text, x, y)
}

export function drawArenaHud(ctx: CanvasRenderingContext2D, s: ArenaState, tick: number): void {
  // 나가기
  ctx.fillStyle = 'rgba(0,0,0,.35)'
  ctx.fillRect(EXIT_RECT.x, EXIT_RECT.y, EXIT_RECT.w, EXIT_RECT.h)
  ctx.font = '9px sans-serif'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillStyle = '#ffffff'
  ctx.fillText('✕', EXIT_RECT.x + EXIT_RECT.w / 2, EXIT_RECT.y + EXIT_RECT.h / 2 + 1)

  const alive = s.fighters.filter((f) => f.alive).length
  ctx.textAlign = 'left'
  ctx.textBaseline = 'alphabetic'
  ctx.font = 'bold 9px sans-serif'
  shadowText(ctx, `남은 친구 ${alive}`, 30, 13, '#ffffff')
  ctx.font = '7px sans-serif'
  const p = s.fighters[0]!
  shadowText(ctx, `${s.map.name} · ★${p.gems} · 쓰러뜨림 ${p.kills}`, 30, 22, 'rgba(255,255,255,.85)')

  // 음소거 — 기존 게임과 같은 자리(MUTE_RECT)에 같은 아이콘
  ctx.font = '9px sans-serif'
  ctx.textAlign = 'right'
  ctx.fillStyle = '#ffffff'
  ctx.fillText(s.muted ? '🔇' : '🔊', VIEW_W - 8, 26)

  ctx.textAlign = 'center'
  const gp = gasProgress(s.t)
  const p0 = s.fighters[0]!
  if (s.scene === 'playing') {
    const r = safeRect(s.t)
    const inGasNow = p0.x < r.x0 || p0.x > r.x1 || p0.y < r.y0 || p0.y > r.y1
    if (inGasNow && Math.floor(tick / 10) % 2 === 0) {
      ctx.font = 'bold 11px sans-serif'
      shadowText(ctx, '독안개! 가운데로!', VIEW_W / 2, 40, '#e0a0ff')
    } else if (gp > 0 && gp < 0.05) {
      ctx.font = 'bold 10px sans-serif'
      shadowText(ctx, '독안개가 몰려온다', VIEW_W / 2, 40, '#e0a0ff')
    }
  }

  if (s.scene === 'countdown') {
    const n = Math.ceil(s.sceneMs / 667)
    ctx.font = 'bold 30px sans-serif'
    shadowText(ctx, n > 0 ? String(n) : '시작!', VIEW_W / 2, VIEW_H / 2 + 8, '#ffe066')
    ctx.font = 'bold 9px sans-serif'
    shadowText(ctx, '마지막까지 살아남으면 1등!', VIEW_W / 2, VIEW_H / 2 + 26, '#ffffff')
  }
  if (s.scene === 'dead') {
    ctx.font = 'bold 22px sans-serif'
    shadowText(ctx, `${playerRank(s)}등!`, VIEW_W / 2, VIEW_H / 2, '#ffe066')
  }
}
