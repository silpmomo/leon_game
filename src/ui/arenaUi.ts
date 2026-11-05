import type { BestRecord, Progress, Rect } from '../types'
import type { ArenaMode, ArenaState } from '../arena/types'
import { VIEW_H, VIEW_W } from '../engine/tuning'
import { ARENA_MAPS } from '../arena/maps'
import { playerRank } from '../arena/scenes'
import { isUnlocked } from '../game/unlock'
import { frame, type LoadedAtlas } from '../render/atlas'

/**
 * 숲속대결의 타이틀 · 판 고르기 · 결과 · 조작 버튼.
 * 하늘전투 UI 와 같은 모양을 따르되 파일은 따로 둔다 (기존 게임 불변 원칙).
 */

export const ARENA_MAP_IDS = ARENA_MAPS.map((m) => m.id)

function inside(r: Rect, px: number, py: number): boolean {
  return px >= r.x && px <= r.x + r.w && py >= r.y && py <= r.y + r.h
}

// ── 공통 ──────────────────────────────────────────────────────

export const ARENA_BACK_RECT: Rect = { x: 6, y: 6, w: 46, h: 15 }

export function arenaBackHitTest(px: number, py: number): boolean {
  return inside(ARENA_BACK_RECT, px, py)
}

function backButton(ctx: CanvasRenderingContext2D, label: string): void {
  const r = ARENA_BACK_RECT
  ctx.fillStyle = 'rgba(0,0,0,.35)'
  ctx.fillRect(r.x, r.y, r.w, r.h)
  ctx.font = '8px sans-serif'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillStyle = '#ffffff'
  ctx.fillText(label, r.x + r.w / 2, r.y + r.h / 2 + 1)
}

function forestBackdrop(ctx: CanvasRenderingContext2D, tick: number): void {
  const g = ctx.createLinearGradient(0, 0, 0, VIEW_H)
  g.addColorStop(0, '#1d4a2a')
  g.addColorStop(1, '#5a9a3c')
  ctx.fillStyle = g
  ctx.fillRect(0, 0, VIEW_W, VIEW_H)
  // 수풀 덤불이 천천히 흔들린다
  for (let i = 0; i < 14; i++) {
    const x = (i * 37) % VIEW_W
    const y = VIEW_H - 10 - ((i * 13) % 18)
    const sway = Math.sin(tick / 20 + i) * 1.5
    ctx.fillStyle = i % 2 ? 'rgba(30,90,40,.8)' : 'rgba(40,110,50,.8)'
    ctx.beginPath()
    ctx.arc(x + sway, y, 12, 0, Math.PI * 2)
    ctx.arc(x + 12 + sway, y + 3, 10, 0, Math.PI * 2)
    ctx.fill()
  }
}

// ── 타이틀 ────────────────────────────────────────────────────

const MODE_W = 110
const MODE_H = 30
const MODE_GAP = 14

export function arenaModeRects(): Record<ArenaMode, Rect> {
  const y = Math.round(VIEW_H * 0.52)
  const x0 = Math.round((VIEW_W - (MODE_W * 2 + MODE_GAP)) / 2)
  return {
    practice: { x: x0, y, w: MODE_W, h: MODE_H },
    challenge: { x: x0 + MODE_W + MODE_GAP, y, w: MODE_W, h: MODE_H },
  }
}

export function arenaModeHitTest(px: number, py: number): ArenaMode | null {
  const r = arenaModeRects()
  if (inside(r.practice, px, py)) return 'practice'
  if (inside(r.challenge, px, py)) return 'challenge'
  return null
}

export function drawArenaTitle(
  ctx: CanvasRenderingContext2D,
  atlas: LoadedAtlas,
  progress: Record<ArenaMode, Progress>,
  tick: number,
): void {
  forestBackdrop(ctx, tick)

  const f = frame(atlas.data, 'face')
  if (f && atlas.image) {
    const w = 24
    const h = Math.round((f.h / f.w) * w)
    ctx.drawImage(atlas.image, f.x, f.y, f.w, f.h, 34, 34 + Math.round(Math.sin(tick / 12) * 2), w, h)
  }

  ctx.textAlign = 'center'
  ctx.textBaseline = 'alphabetic'
  ctx.font = 'bold 21px sans-serif'
  ctx.fillStyle = 'rgba(0,0,0,.4)'
  ctx.fillText('리온의 숲속대결', VIEW_W / 2 + 1, 43)
  ctx.fillStyle = '#ffe066'
  ctx.fillText('리온의 숲속대결', VIEW_W / 2, 42)

  ctx.font = '8px sans-serif'
  ctx.fillStyle = 'rgba(255,255,255,.88)'
  ctx.fillText(`탑뷰 서바이벌 · 전 ${ARENA_MAPS.length}판 · 마지막까지 살아남으면 1등`, VIEW_W / 2, 58)
  ctx.fillText('상자를 부숴 ★을 모으면 더 세진다 · 보라 안개를 피하자', VIEW_W / 2, 70)

  const r = arenaModeRects()
  const labels: Record<ArenaMode, [string, string]> = {
    practice: ['연습', '친구들이 약하게 때린다'],
    challenge: ['도전', '진짜 대결 · 기록 남김'],
  }
  for (const m of ['practice', 'challenge'] as ArenaMode[]) {
    const b = r[m]
    const done = Object.values(progress[m]).filter((x) => x.cleared).length
    ctx.fillStyle = m === 'practice' ? 'rgba(75,192,174,.9)' : 'rgba(240,122,74,.9)'
    ctx.fillRect(b.x, b.y, b.w, b.h)
    ctx.fillStyle = '#ffffff'
    ctx.font = 'bold 12px sans-serif'
    ctx.fillText(labels[m][0], b.x + b.w / 2, b.y + 15)
    ctx.font = '7px sans-serif'
    ctx.fillText(`${labels[m][1]} · ${done}/${ARENA_MAPS.length}`, b.x + b.w / 2, b.y + 25)
  }

  ctx.font = '7px sans-serif'
  ctx.fillStyle = 'rgba(255,255,255,.8)'
  ctx.fillText('왼쪽을 끌어서 움직이고, 오른쪽 아래 버튼을 누르고 있으면 자동으로 쏜다', VIEW_W / 2, VIEW_H - 22)

  backButton(ctx, '← 게임')
}

// ── 판 고르기 ─────────────────────────────────────────────────

const COLS = 3
const CELL_W = 104
const CELL_H = 44
const CELL_GAP = 10

export function arenaCellRect(i: number): Rect {
  const col = i % COLS
  const row = Math.floor(i / COLS)
  const x0 = Math.round((VIEW_W - (CELL_W * COLS + CELL_GAP * (COLS - 1))) / 2)
  return {
    x: x0 + col * (CELL_W + CELL_GAP),
    y: 48 + row * (CELL_H + 12),
    w: CELL_W,
    h: CELL_H,
  }
}

export function arenaMapHitTest(px: number, py: number, progress: Progress): number | null {
  for (let i = 0; i < ARENA_MAPS.length; i++) {
    if (!inside(arenaCellRect(i), px, py)) continue
    return isUnlocked(ARENA_MAP_IDS, i, progress) ? i : null
  }
  return null
}

const THEME_TINT: Record<string, string> = {
  meadow: '#6fb84a', lake: '#3f8fd0', rock: '#8a7a5c',
  mushroom: '#b06a8a', river: '#3a9ac8', royal: '#7a5aba',
}

export function drawArenaSelect(
  ctx: CanvasRenderingContext2D,
  progress: Progress,
  modeLabel: string,
  selected: number,
  tick: number,
): void {
  forestBackdrop(ctx, tick)

  ctx.textAlign = 'center'
  ctx.textBaseline = 'alphabetic'
  ctx.font = 'bold 13px sans-serif'
  ctx.fillStyle = '#ffffff'
  ctx.fillText(`숲속대결 · ${modeLabel}`, VIEW_W / 2, 32)

  for (let i = 0; i < ARENA_MAPS.length; i++) {
    const m = ARENA_MAPS[i]!
    const r = arenaCellRect(i)
    const open = isUnlocked(ARENA_MAP_IDS, i, progress)
    const rec: BestRecord | undefined = progress[m.id]

    ctx.fillStyle = open ? THEME_TINT[m.theme] ?? '#6a7a8a' : 'rgba(255,255,255,.08)'
    ctx.globalAlpha = open ? 0.92 : 1
    ctx.fillRect(r.x, r.y, r.w, r.h)
    ctx.globalAlpha = 1
    ctx.lineWidth = i === selected && open ? 2 : 1
    ctx.strokeStyle = i === selected && open ? '#ffe066'
      : open ? 'rgba(255,255,255,.6)' : 'rgba(255,255,255,.18)'
    ctx.strokeRect(r.x + .5, r.y + .5, r.w - 1, r.h - 1)

    if (!open) {
      ctx.font = '13px sans-serif'
      ctx.fillStyle = 'rgba(255,255,255,.5)'
      ctx.fillText('🔒', r.x + r.w / 2, r.y + r.h / 2 + 5)
      continue
    }

    ctx.font = 'bold 11px sans-serif'
    ctx.fillStyle = '#ffffff'
    ctx.fillText(`${i + 1}판 ${m.name}`, r.x + r.w / 2, r.y + 16)
    ctx.font = '7px sans-serif'
    ctx.fillStyle = 'rgba(255,255,255,.92)'
    ctx.fillText(`친구 ${m.bots}명과 대결`, r.x + r.w / 2, r.y + 27)

    if (rec?.cleared) {
      ctx.fillStyle = '#ffe066'
      ctx.font = '8px sans-serif'
      ctx.fillText(`👑 1등 · ${rec.bestScore}점`, r.x + r.w / 2, r.y + 39)
    } else if (rec && rec.bestScore > 0) {
      ctx.fillStyle = 'rgba(255,255,255,.75)'
      ctx.font = '7px sans-serif'
      ctx.fillText(`최고 ${rec.bestScore}점`, r.x + r.w / 2, r.y + 39)
    }
  }

  ctx.font = '7px sans-serif'
  ctx.fillStyle = 'rgba(255,255,255,.8)'
  ctx.fillText('1등을 하면 다음 판이 열린다', VIEW_W / 2, VIEW_H - 10)

  backButton(ctx, '← 처음')
}

// ── 결과 ──────────────────────────────────────────────────────

export type ArenaResultAction = 'next' | 'again' | 'select'

const RES_W = 92
const RES_H = 26

function resultRects(hasNext: boolean): { id: ArenaResultAction; r: Rect }[] {
  const ids: ArenaResultAction[] = hasNext ? ['next', 'again', 'select'] : ['again', 'select']
  const total = RES_W * ids.length + 10 * (ids.length - 1)
  const x0 = Math.round((VIEW_W - total) / 2)
  const y = VIEW_H - 44
  return ids.map((id, i) => ({ id, r: { x: x0 + i * (RES_W + 10), y, w: RES_W, h: RES_H } }))
}

export function arenaResultHitTest(
  px: number, py: number, hasNext: boolean,
): ArenaResultAction | null {
  for (const { id, r } of resultRects(hasNext)) {
    if (inside(r, px, py)) return id
  }
  return null
}

const RES_LABEL: Record<ArenaResultAction, string> = {
  next: '다음 판 ▶',
  again: '다시',
  select: '판 고르기',
}

export function drawArenaResult(
  ctx: CanvasRenderingContext2D,
  s: ArenaState,
  hasNext: boolean,
): void {
  ctx.fillStyle = 'rgba(8,20,10,.74)'
  ctx.fillRect(0, 0, VIEW_W, VIEW_H)

  const win = s.scene === 'clear'
  const rank = playerRank(s)
  const total = s.fighters.length
  ctx.textAlign = 'center'
  ctx.textBaseline = 'alphabetic'
  ctx.font = 'bold 24px sans-serif'
  ctx.fillStyle = win ? '#ffe066' : rank <= 3 ? '#ffd0a0' : '#ff9a8a'
  ctx.fillText(win ? '👑 1등! 최후의 승자!' : `${rank}등`, VIEW_W / 2, 50)

  ctx.font = '9px sans-serif'
  ctx.fillStyle = 'rgba(255,255,255,.85)'
  ctx.fillText(
    win ? `${s.map.name}에서 ${total - 1}명을 모두 이겼다`
      : rank <= 3 ? '아깝다! 조금만 더 버티면 1등' : '수풀에 숨어서 기회를 노려 보자',
    VIEW_W / 2, 66,
  )

  const p = s.fighters[0]!
  ctx.font = '10px monospace'
  ctx.fillStyle = '#ffffff'
  ctx.fillText(`점수 ${s.score}`, VIEW_W / 2, 86)
  ctx.font = '8px sans-serif'
  ctx.fillStyle = 'rgba(255,255,255,.8)'
  ctx.fillText(`쓰러뜨림 ${p.kills} · 모은 ★ ${p.gems} · ${Math.round(s.t)}초`, VIEW_W / 2, 100)

  for (const { id, r } of resultRects(hasNext)) {
    ctx.fillStyle = id === 'next' ? 'rgba(75,192,174,.9)' : 'rgba(255,255,255,.16)'
    ctx.fillRect(r.x, r.y, r.w, r.h)
    ctx.fillStyle = '#ffffff'
    ctx.font = 'bold 10px sans-serif'
    ctx.fillText(RES_LABEL[id], r.x + r.w / 2, r.y + 17)
  }
}

// ── 조작 버튼 ─────────────────────────────────────────────────

/** 공격 버튼 — 기존 게임 버튼과 같은 오른쪽 아래 손 자리 */
const FIRE_SIZE = Math.round(VIEW_W * 0.13)
const SUPER_SIZE = Math.round(VIEW_W * 0.085)
const EDGE = Math.round(VIEW_W * 0.015)
const BOTTOM = Math.round(VIEW_H * 0.03)
/** 아이 손가락은 정확하지 않다. 보이는 원보다 넉넉히 잡는다 */
const HIT_GROW = 0.25

export const FIRE_RECT: Rect = {
  x: VIEW_W - EDGE - FIRE_SIZE,
  y: VIEW_H - BOTTOM - FIRE_SIZE,
  w: FIRE_SIZE,
  h: FIRE_SIZE,
}

export const SUPER_RECT: Rect = {
  x: FIRE_RECT.x - SUPER_SIZE - 4,
  y: FIRE_RECT.y - SUPER_SIZE + 6,
  w: SUPER_SIZE,
  h: SUPER_SIZE,
}

/** 이 선 왼쪽을 누르면 이동 조이스틱이 생긴다 */
export const JOY_ZONE_X = Math.round(VIEW_W * 0.55)
export const JOY_R = 22

function circleHit(r: Rect, px: number, py: number): boolean {
  const cx = r.x + r.w / 2
  const cy = r.y + r.h / 2
  const rr = (r.w / 2) * (1 + HIT_GROW)
  return (px - cx) ** 2 + (py - cy) ** 2 <= rr * rr
}

export function fireHitTest(px: number, py: number): boolean {
  return circleHit(FIRE_RECT, px, py)
}

export function superHitTest(px: number, py: number): boolean {
  return circleHit(SUPER_RECT, px, py)
}

export type JoyView = { ox: number; oy: number; kx: number; ky: number } | null

export function drawArenaControls(
  ctx: CanvasRenderingContext2D,
  joy: JoyView,
  ammo: number,
  superCharge: number,
  firing: boolean,
  tick: number,
): void {
  ctx.save()

  // 이동 조이스틱 — 누른 자리에 생긴다. 안 누르면 왼쪽 아래에 흐리게 안내만
  const o = joy ?? { ox: 44, oy: VIEW_H - 44, kx: 44, ky: VIEW_H - 44 }
  ctx.globalAlpha = joy ? 0.5 : 0.22
  ctx.fillStyle = '#000000'
  ctx.beginPath()
  ctx.arc(o.ox, o.oy, JOY_R, 0, Math.PI * 2)
  ctx.fill()
  ctx.strokeStyle = '#ffffff'
  ctx.lineWidth = 1.5
  ctx.stroke()
  ctx.globalAlpha = joy ? 0.85 : 0.35
  ctx.fillStyle = '#4bc0ae'
  ctx.beginPath()
  ctx.arc(o.kx, o.ky, 9, 0, Math.PI * 2)
  ctx.fill()

  // 공격
  const fx = FIRE_RECT.x + FIRE_RECT.w / 2
  const fy = FIRE_RECT.y + FIRE_RECT.h / 2
  const fr = FIRE_RECT.w / 2
  ctx.globalAlpha = firing ? 0.6 : 0.42
  ctx.fillStyle = ammo >= 1 ? '#c8502c' : '#5a4a48'
  ctx.beginPath()
  ctx.arc(fx, fy, fr, 0, Math.PI * 2)
  ctx.fill()
  ctx.globalAlpha = 0.95
  ctx.strokeStyle = '#ffb04a'
  ctx.lineWidth = 2
  ctx.stroke()
  // 탄창 눈금
  for (let i = 0; i < 3; i++) {
    const a0 = -Math.PI / 2 + (i / 3) * Math.PI * 2 + 0.08
    const a1 = -Math.PI / 2 + ((i + Math.min(1, Math.max(0, ammo - i))) / 3) * Math.PI * 2 - 0.08
    if (a1 <= a0) continue
    ctx.strokeStyle = '#ffe0a0'
    ctx.lineWidth = 3
    ctx.beginPath()
    ctx.arc(fx, fy, fr - 4, a0, a1)
    ctx.stroke()
  }
  // 과녁 아이콘
  ctx.strokeStyle = '#ffffff'
  ctx.lineWidth = 1.5
  ctx.beginPath()
  ctx.arc(fx, fy, 7, 0, Math.PI * 2)
  ctx.moveTo(fx - 11, fy)
  ctx.lineTo(fx + 11, fy)
  ctx.moveTo(fx, fy - 11)
  ctx.lineTo(fx, fy + 11)
  ctx.stroke()

  // 필살기
  const sx = SUPER_RECT.x + SUPER_RECT.w / 2
  const sy = SUPER_RECT.y + SUPER_RECT.h / 2
  const sr = SUPER_RECT.w / 2
  const ready = superCharge >= 1
  ctx.globalAlpha = ready ? 0.75 : 0.35
  ctx.fillStyle = ready ? '#e0b020' : '#4a4a52'
  ctx.beginPath()
  ctx.arc(sx, sy, sr, 0, Math.PI * 2)
  ctx.fill()
  ctx.globalAlpha = 0.95
  ctx.strokeStyle = '#ffe066'
  ctx.lineWidth = 2
  ctx.beginPath()
  ctx.arc(sx, sy, sr - 1, -Math.PI / 2, -Math.PI / 2 + Math.min(1, superCharge) * Math.PI * 2)
  ctx.stroke()
  ctx.font = '12px sans-serif'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillStyle = '#ffffff'
  ctx.fillText('⚡', sx, sy + 1)
  if (ready && Math.floor(tick / 8) % 2 === 0) {
    ctx.globalAlpha = 0.3
    ctx.fillStyle = '#ffffff'
    ctx.beginPath()
    ctx.arc(sx, sy, sr, 0, Math.PI * 2)
    ctx.fill()
  }
  ctx.restore()
}
