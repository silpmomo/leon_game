import type { Enemy, GameState, Player, PowerState, Tile } from '../types'
import { TILE, VIEW_H, VIEW_W } from '../engine/tuning'
import { tileAt } from '../world/tilemap'
import { BUTTON_ALPHA, buttonRects } from '../ui/controls'
import { FALLBACK_COLOR, frame, type LoadedAtlas } from './atlas'

const TILE_FRAME: Partial<Record<Tile, string>> = {
  '#': 'ground',
  B: 'brick',
  b: 'brick',
  '?': 'question',
  '@': 'question',
  '*': 'question',
  H: 'hard',
  p: 'pipeTop',
  '|': 'pipeBody',
}

/** 얼굴/몸통 비율. 합이 스프라이트 전체 높이가 된다. */
const HERO_LAYOUT = {
  small: { faceW: 13, faceH: 15, bodyW: 16, bodyH: 12 },
  big: { faceW: 15, faceH: 17, bodyW: 20, bodyH: 18 },
} as const

function draw(
  ctx: CanvasRenderingContext2D,
  atlas: LoadedAtlas,
  name: string,
  x: number,
  y: number,
  w: number,
  h: number,
  flip = false,
): void {
  const f = frame(atlas.data, name)
  if (atlas.image && f) {
    ctx.save()
    if (flip) {
      ctx.translate(Math.round(x) + w, Math.round(y))
      ctx.scale(-1, 1)
      ctx.drawImage(atlas.image, f.x, f.y, f.w, f.h, 0, 0, w, h)
    } else {
      ctx.drawImage(atlas.image, f.x, f.y, f.w, f.h, Math.round(x), Math.round(y), w, h)
    }
    ctx.restore()
    return
  }
  // 자홍색이 보이면 정의되지 않은 프레임을 요청한 것이다
  ctx.fillStyle = FALLBACK_COLOR[name] ?? '#ff00ff'
  ctx.fillRect(Math.round(x), Math.round(y), w, h)
}

function heroBodyFrame(p: Player): string {
  const big = p.power !== 'small'
  if (big) {
    if (!p.onGround) return 'heroBigJump'
    return Math.abs(p.vx) > 5 ? 'heroBigWalk1' : 'heroBigIdle'
  }
  if (p.skidding) return 'heroSmallSkid'
  if (!p.onGround) return 'heroSmallJump'
  if (Math.abs(p.vx) <= 5) return 'heroSmallIdle'
  // 속도에 맞춰 걷기 4프레임을 순환한다
  const phase = Math.floor(Math.abs(p.x) / 6) % 4
  return `heroSmallWalk${phase + 1}`
}

function drawHero(ctx: CanvasRenderingContext2D, atlas: LoadedAtlas, p: Player): void {
  const big = p.power !== 'small'
  const L = big ? HERO_LAYOUT.big : HERO_LAYOUT.small
  // 히트박스 중심에 스프라이트 중심을 맞춘다 (스프라이트가 히트박스보다 넓다)
  const cx = p.x + p.w / 2
  const bottom = p.y + p.h
  const flip = p.facing === -1

  draw(ctx, atlas, heroBodyFrame(p), cx - L.bodyW / 2, bottom - L.bodyH, L.bodyW, L.bodyH, flip)
  const faceY = bottom - L.bodyH - L.faceH + 2 // 2px 겹쳐 목 경계를 감춘다
  draw(ctx, atlas, 'face', cx - L.faceW / 2, faceY, L.faceW, L.faceH, flip)

  if (p.invulnMs > 0) {
    draw(ctx, atlas, 'eyesShut', cx - L.faceW / 2, faceY + Math.round(L.faceH * 0.35), L.faceW, 6, flip)
  }
}

function enemyFrame(e: Enemy, t: number): string {
  if (e.squashMs > 0) return e.kind === 'broccoli' ? 'broccoliSquash' : `${e.kind}0`
  switch (e.kind) {
    case 'broccoli':
      return `broccoli${Math.floor(t / 8) % 2}`
    case 'soup':
      return e.onGround ? 'soupCrouch' : 'soupJump'
    case 'crocodile':
      return `crocodile${Math.floor(t / 6) % 2}`
  }
}

export function drawWorld(
  ctx: CanvasRenderingContext2D,
  s: GameState,
  atlas: LoadedAtlas,
  tick: number,
): void {
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

  const bumpAt = new Map<string, number>()
  for (const b of s.bumps) bumpAt.set(`${b.tx},${b.ty}`, b.ms)

  for (let tx = tx0; tx <= tx1; tx++) {
    for (let ty = 0; ty < s.grid.h; ty++) {
      const t = tileAt(s.grid, tx, ty)
      const name = TILE_FRAME[t]
      if (!name) continue
      // 아래에서 친 블록은 살짝 위로 튕긴다
      const bump = bumpAt.get(`${tx},${ty}`)
      const lift = bump ? Math.round(Math.sin((bump / 140) * Math.PI) * 4) : 0
      draw(ctx, atlas, name, tx * TILE, ty * TILE - lift, TILE, TILE)
    }
  }

  // 깃대 (타일이 아니라 goal 데이터로 그린다)
  const goalX = s.level.goal.x * TILE
  for (let ty = s.level.goal.flagTop; ty < s.level.height - 2; ty++) {
    draw(ctx, atlas, ty === s.level.goal.flagTop ? 'flag' : 'flagPole', goalX, ty * TILE, TILE, TILE)
  }
  for (let i = 0; i < 3; i++) {
    draw(ctx, atlas, 'castle', goalX + (5 + i) * TILE, (s.level.height - 4) * TILE, TILE, TILE * 2)
  }

  // 코인
  for (const c of s.coins) {
    if (c.taken) continue
    draw(ctx, atlas, `coin${Math.floor(tick / 6) % 4}`, c.x, c.y, c.w, c.h)
  }

  // 아이템
  for (const it of s.items) {
    if (it.taken) continue
    draw(ctx, atlas, it.kind === 'peach' ? 'peach' : 'ball0', it.x, it.y, it.w, it.h)
  }

  // 이동발판
  for (const pf of s.platforms) {
    for (let i = 0; i < pf.w / TILE; i++) {
      draw(ctx, atlas, 'used', pf.x + i * TILE, pf.y, TILE, pf.h)
    }
  }

  // 적
  for (const e of s.enemies) {
    if (!e.alive) continue
    draw(ctx, atlas, enemyFrame(e, tick), e.x, e.y, e.w, e.h, e.dir === 1)
  }

  // 축구공
  for (const b of s.balls) {
    if (!b.alive) continue
    draw(ctx, atlas, `ball${Math.floor(tick / 4) % 4}`, b.x, b.y, b.w, b.h)
  }

  // 플레이어 — 무적 중에는 깜빡인다
  const blink = s.player.invulnMs > 0 && Math.floor(s.player.invulnMs / 80) % 2 === 0
  if (!blink) drawHero(ctx, atlas, s.player)

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
