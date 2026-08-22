import type { BestRecord, Progress, Rect } from '../types'
import type { SkyMode, SkyState } from '../sky/types'
import { VIEW_H, VIEW_W } from '../engine/tuning'
import { SKY_STAGES } from '../sky/stages'
import { isUnlocked } from '../game/unlock'
import { frame, type LoadedAtlas } from '../render/atlas'

/**
 * 하늘전투의 타이틀 · 탄 고르기 · 결과 화면.
 *
 * 기존 게임의 화면들을 재사용하지 않고 따로 쓴다. 그쪽은 LevelData 에
 * 묶여 있고, 손대면 이미 돌아가는 게임이 흔들린다.
 */

export const SKY_STAGE_IDS = SKY_STAGES.map((s) => s.id)

function inside(r: Rect, px: number, py: number): boolean {
  return px >= r.x && px <= r.x + r.w && py >= r.y && py <= r.y + r.h
}

// ── 타이틀 ────────────────────────────────────────────────────

export const SKY_HUB_RECT: Rect = { x: 6, y: 6, w: 46, h: 15 }

const MODE_W = 110
const MODE_H = 30
const MODE_GAP = 14

function modeRects(): Record<SkyMode, Rect> {
  const y = Math.round(VIEW_H * 0.58)
  const x0 = Math.round((VIEW_W - (MODE_W * 2 + MODE_GAP)) / 2)
  return {
    practice: { x: x0, y, w: MODE_W, h: MODE_H },
    challenge: { x: x0 + MODE_W + MODE_GAP, y, w: MODE_W, h: MODE_H },
  }
}

export function skyHubHitTest(px: number, py: number): boolean {
  return inside(SKY_HUB_RECT, px, py)
}

export function skyModeHitTest(px: number, py: number): SkyMode | null {
  const r = modeRects()
  if (inside(r.practice, px, py)) return 'practice'
  if (inside(r.challenge, px, py)) return 'challenge'
  return null
}

function backButton(ctx: CanvasRenderingContext2D, label: string): void {
  ctx.fillStyle = 'rgba(0,0,0,.35)'
  ctx.fillRect(SKY_HUB_RECT.x, SKY_HUB_RECT.y, SKY_HUB_RECT.w, SKY_HUB_RECT.h)
  ctx.font = '8px sans-serif'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillStyle = '#ffffff'
  ctx.fillText(label, SKY_HUB_RECT.x + SKY_HUB_RECT.w / 2, SKY_HUB_RECT.y + SKY_HUB_RECT.h / 2 + 1)
}

function skyBackdrop(ctx: CanvasRenderingContext2D, tick: number): void {
  const g = ctx.createLinearGradient(0, 0, 0, VIEW_H)
  g.addColorStop(0, '#1a2a58')
  g.addColorStop(1, '#5f9fd0')
  ctx.fillStyle = g
  ctx.fillRect(0, 0, VIEW_W, VIEW_H)
  ctx.fillStyle = 'rgba(255,255,255,.35)'
  for (let i = 0; i < 34; i++) {
    ctx.fillRect((i * 89 + Math.floor(tick / 3)) % VIEW_W, 6 + ((i * 47) % 60), 2, 2)
  }
  ctx.fillStyle = 'rgba(255,255,255,.16)'
  for (let i = 0; i < 5; i++) {
    const x = (i * 103 - tick * 0.4) % (VIEW_W + 100)
    ctx.beginPath()
    ctx.ellipse(x < -50 ? x + VIEW_W + 100 : x, 40 + ((i * 37) % 90), 30, 8, 0, 0, Math.PI * 2)
    ctx.fill()
  }
}

export function drawSkyTitle(
  ctx: CanvasRenderingContext2D,
  atlas: LoadedAtlas,
  progress: Record<SkyMode, Progress>,
  tick: number,
): void {
  skyBackdrop(ctx, tick)

  const f = frame(atlas.data, 'face')
  if (f && atlas.image) {
    const w = 26
    const h = Math.round((f.h / f.w) * w)
    ctx.drawImage(atlas.image, f.x, f.y, f.w, f.h, 30, 46 + Math.round(Math.sin(tick / 12) * 3), w, h)
  }

  ctx.textAlign = 'center'
  ctx.textBaseline = 'alphabetic'
  ctx.font = 'bold 21px sans-serif'
  ctx.fillStyle = 'rgba(0,0,0,.4)'
  ctx.fillText('리온의 하늘전투', VIEW_W / 2 + 1, 51)
  ctx.fillStyle = '#ffe066'
  ctx.fillText('리온의 하늘전투', VIEW_W / 2, 50)

  ctx.font = '8px sans-serif'
  ctx.fillStyle = 'rgba(255,255,255,.85)'
  ctx.fillText('횡스크롤 슈팅 · 전 10탄 · 미사일은 자동', VIEW_W / 2, 66)

  const r = modeRects()
  const labels: Record<SkyMode, [string, string]> = {
    practice: ['연습', '목숨 무한'],
    challenge: ['도전', `목숨 3 · 기록 남김`],
  }
  for (const m of ['practice', 'challenge'] as SkyMode[]) {
    const b = r[m]
    const done = Object.values(progress[m]).filter((x) => x.cleared).length
    ctx.fillStyle = m === 'practice' ? 'rgba(75,192,174,.85)' : 'rgba(240,122,74,.85)'
    ctx.fillRect(b.x, b.y, b.w, b.h)
    ctx.fillStyle = '#ffffff'
    ctx.font = 'bold 12px sans-serif'
    ctx.fillText(labels[m][0], b.x + b.w / 2, b.y + 15)
    ctx.font = '7px sans-serif'
    ctx.fillText(`${labels[m][1]} · ${done}/10`, b.x + b.w / 2, b.y + 25)
  }

  ctx.font = '7px sans-serif'
  ctx.fillStyle = 'rgba(255,255,255,.7)'
  ctx.fillText('화면을 끌어서 움직이고, 오른쪽 아래 번개로 궁극기', VIEW_W / 2, VIEW_H - 8)

  backButton(ctx, '← 게임')
}

// ── 탄 고르기 ─────────────────────────────────────────────────

const COLS = 5
const CELL_W = 66
const CELL_H = 44
const CELL_GAP = 8

export function skyCellRect(i: number): Rect {
  const col = i % COLS
  const row = Math.floor(i / COLS)
  const x0 = Math.round((VIEW_W - (CELL_W * COLS + CELL_GAP * (COLS - 1))) / 2)
  return {
    x: x0 + col * (CELL_W + CELL_GAP),
    y: 56 + row * (CELL_H + 12),
    w: CELL_W,
    h: CELL_H,
  }
}

export function skyStageHitTest(px: number, py: number, progress: Progress): number | null {
  for (let i = 0; i < SKY_STAGES.length; i++) {
    if (!inside(skyCellRect(i), px, py)) continue
    return isUnlocked(SKY_STAGE_IDS, i, progress) ? i : null
  }
  return null
}

const THEME_TINT: Record<string, string> = {
  dawn: '#e8a06a', cloud: '#9fd8f5', forest: '#4f8f3f', storm: '#5a6478',
  volcano: '#e0602c', night: '#3a3f7a', ice: '#8fc4e0', desert: '#d8a04a',
  steam: '#7a7a88', castle: '#8a5aba',
}

export function drawSkySelect(
  ctx: CanvasRenderingContext2D,
  progress: Progress,
  modeLabel: string,
  tick: number,
): void {
  skyBackdrop(ctx, tick)

  ctx.textAlign = 'center'
  ctx.textBaseline = 'alphabetic'
  ctx.font = 'bold 13px sans-serif'
  ctx.fillStyle = '#ffffff'
  ctx.fillText(`하늘전투 · ${modeLabel}`, VIEW_W / 2, 34)

  for (let i = 0; i < SKY_STAGES.length; i++) {
    const st = SKY_STAGES[i]!
    const r = skyCellRect(i)
    const open = isUnlocked(SKY_STAGE_IDS, i, progress)
    const rec: BestRecord | undefined = progress[st.id]

    ctx.fillStyle = open ? THEME_TINT[st.theme] ?? '#6a7a8a' : 'rgba(255,255,255,.08)'
    ctx.globalAlpha = open ? 0.9 : 1
    ctx.fillRect(r.x, r.y, r.w, r.h)
    ctx.globalAlpha = 1
    ctx.lineWidth = 1
    ctx.strokeStyle = open ? 'rgba(255,255,255,.6)' : 'rgba(255,255,255,.18)'
    ctx.strokeRect(r.x + .5, r.y + .5, r.w - 1, r.h - 1)

    if (!open) {
      ctx.font = '13px sans-serif'
      ctx.fillStyle = 'rgba(255,255,255,.5)'
      ctx.fillText('🔒', r.x + r.w / 2, r.y + r.h / 2 + 5)
      continue
    }

    ctx.font = 'bold 13px sans-serif'
    ctx.fillStyle = '#ffffff'
    ctx.fillText(`${i + 1}탄`, r.x + r.w / 2, r.y + 17)
    ctx.font = '7px sans-serif'
    ctx.fillStyle = 'rgba(255,255,255,.9)'
    ctx.fillText(st.name, r.x + r.w / 2, r.y + 28)

    if (rec?.cleared) {
      ctx.fillStyle = '#ffe066'
      ctx.font = '8px sans-serif'
      ctx.fillText(`★ ${rec.bestScore}`, r.x + r.w / 2, r.y + 39)
    }
  }

  backButton(ctx, '← 처음')
}

// ── 결과 ──────────────────────────────────────────────────────

export type SkyResultAction = 'next' | 'again' | 'select'

const RES_W = 92
const RES_H = 26

function resultRects(hasNext: boolean): { id: SkyResultAction; r: Rect }[] {
  const ids: SkyResultAction[] = hasNext ? ['next', 'again', 'select'] : ['again', 'select']
  const total = RES_W * ids.length + 10 * (ids.length - 1)
  const x0 = Math.round((VIEW_W - total) / 2)
  const y = VIEW_H - 44
  return ids.map((id, i) => ({ id, r: { x: x0 + i * (RES_W + 10), y, w: RES_W, h: RES_H } }))
}

export function skyResultHitTest(
  px: number, py: number, hasNext: boolean,
): SkyResultAction | null {
  for (const { id, r } of resultRects(hasNext)) {
    if (inside(r, px, py)) return id
  }
  return null
}

const RES_LABEL: Record<SkyResultAction, string> = {
  next: '다음 탄 ▶',
  again: '다시',
  select: '탄 고르기',
}

export function drawSkyResult(
  ctx: CanvasRenderingContext2D,
  s: SkyState,
  hasNext: boolean,
): void {
  ctx.fillStyle = 'rgba(6,10,26,.72)'
  ctx.fillRect(0, 0, VIEW_W, VIEW_H)

  const win = s.scene === 'clear'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'alphabetic'
  ctx.font = 'bold 20px sans-serif'
  ctx.fillStyle = win ? '#ffe066' : '#ff8a7a'
  ctx.fillText(win ? `${s.stage.name} 클리어!` : '게임 오버', VIEW_W / 2, 54)

  ctx.font = '10px monospace'
  ctx.fillStyle = '#ffffff'
  ctx.fillText(`점수 ${s.score}`, VIEW_W / 2, 76)
  ctx.font = '8px sans-serif'
  ctx.fillStyle = 'rgba(255,255,255,.8)'
  ctx.fillText(
    win
      ? `죽은 횟수 ${s.deaths}${s.deaths === 0 ? ' · 노 미스 보너스!' : ''}`
      : '다시 해 보자',
    VIEW_W / 2, 90,
  )

  for (const { id, r } of resultRects(hasNext)) {
    ctx.fillStyle = id === 'next' ? 'rgba(75,192,174,.9)' : 'rgba(255,255,255,.16)'
    ctx.fillRect(r.x, r.y, r.w, r.h)
    ctx.fillStyle = '#ffffff'
    ctx.font = 'bold 10px sans-serif'
    ctx.fillText(RES_LABEL[id], r.x + r.w / 2, r.y + 17)
  }
}

/** 죽는 중에 띄우는 짧은 안내 */
export function drawSkyDead(ctx: CanvasRenderingContext2D, s: SkyState): void {
  ctx.textAlign = 'center'
  ctx.textBaseline = 'alphabetic'
  ctx.font = 'bold 13px sans-serif'
  ctx.fillStyle = 'rgba(255,255,255,.9)'
  const left = s.lives === Number.POSITIVE_INFINITY ? '∞' : String(Math.max(0, s.lives))
  ctx.fillText(`남은 리온 ${left}`, VIEW_W / 2, VIEW_H / 2)
}
