import type { LevelData, Progress, Rect, Theme } from '../types'
import { VIEW_H, VIEW_W } from '../engine/tuning'
import { isUnlocked } from '../game/unlock'

const COLS = 5
const ROWS = 2
const CELL = 52
const GAP_X = 10
const GAP_Y = 12
const TOP = 52

export const BACK_RECT: Rect = { x: 6, y: 6, w: 46, h: 16 }

function gridOrigin(): { x: number; y: number } {
  const totalW = COLS * CELL + (COLS - 1) * GAP_X
  return { x: Math.round((VIEW_W - totalW) / 2), y: TOP }
}

export function cellRect(index: number): Rect {
  const o = gridOrigin()
  const c = index % COLS
  const r = Math.floor(index / COLS)
  return { x: o.x + c * (CELL + GAP_X), y: o.y + r * (CELL + GAP_Y), w: CELL, h: CELL }
}

function inside(r: Rect, px: number, py: number): boolean {
  return px >= r.x && px <= r.x + r.w && py >= r.y && py <= r.y + r.h
}

/** 잠긴 칸을 눌러도 null 을 준다 */
export function stageHitTest(
  px: number,
  py: number,
  stages: readonly LevelData[],
  progress: Progress,
): number | null {
  const ids = stages.map((s) => s.id)
  for (let i = 0; i < Math.min(stages.length, COLS * ROWS); i++) {
    if (!inside(cellRect(i), px, py)) continue
    return isUnlocked(ids, i, progress) ? i : null
  }
  return null
}

export function backHitTest(px: number, py: number): boolean {
  return inside(BACK_RECT, px, py)
}

const THEME_TINT: Record<Theme, string> = {
  day: '#4bc0ae',
  underground: '#5a7fb8',
  night: '#5b5ba8',
  castle: '#c05a4a',
}

export function drawStageSelect(
  ctx: CanvasRenderingContext2D,
  stages: readonly LevelData[],
  progress: Progress,
  modeLabel: string,
): void {
  const sky = ctx.createLinearGradient(0, 0, 0, VIEW_H)
  sky.addColorStop(0, '#1d2b45')
  sky.addColorStop(1, '#3f5f86')
  ctx.fillStyle = sky
  ctx.fillRect(0, 0, VIEW_W, VIEW_H)

  // 뒤로 가기
  ctx.fillStyle = 'rgba(255,255,255,.18)'
  ctx.fillRect(BACK_RECT.x, BACK_RECT.y, BACK_RECT.w, BACK_RECT.h)
  ctx.fillStyle = '#fff'
  ctx.font = 'bold 9px sans-serif'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText('← 처음', BACK_RECT.x + BACK_RECT.w / 2, BACK_RECT.y + BACK_RECT.h / 2 + 1)

  ctx.font = 'bold 13px sans-serif'
  ctx.fillText(`탄 고르기 · ${modeLabel}`, VIEW_W / 2, 24)

  const ids = stages.map((s) => s.id)
  const cleared = ids.filter((id) => progress[id]?.cleared).length
  ctx.font = '8px monospace'
  ctx.fillStyle = 'rgba(255,255,255,.75)'
  ctx.fillText(`${cleared} / ${stages.length} 클리어`, VIEW_W / 2, 38)

  for (let i = 0; i < Math.min(stages.length, COLS * ROWS); i++) {
    const st = stages[i]!
    const r = cellRect(i)
    const open = isUnlocked(ids, i, progress)
    const rec = progress[st.id]

    ctx.fillStyle = open ? THEME_TINT[st.theme] : 'rgba(255,255,255,.10)'
    ctx.fillRect(r.x, r.y, r.w, r.h)
    ctx.lineWidth = 2
    ctx.strokeStyle = open ? 'rgba(255,255,255,.85)' : 'rgba(255,255,255,.22)'
    ctx.strokeRect(r.x + 1, r.y + 1, r.w - 2, r.h - 2)

    if (!open) {
      ctx.fillStyle = 'rgba(255,255,255,.5)'
      ctx.font = '16px sans-serif'
      ctx.fillText('🔒', r.x + r.w / 2, r.y + r.h / 2)
      continue
    }

    ctx.fillStyle = '#fff'
    ctx.font = 'bold 17px sans-serif'
    ctx.fillText(String(i + 1), r.x + r.w / 2, r.y + 20)
    ctx.font = '7px sans-serif'
    ctx.fillStyle = 'rgba(255,255,255,.85)'
    ctx.fillText(st.theme === 'day' ? '지상'
      : st.theme === 'underground' ? '지하'
        : st.theme === 'night' ? '밤' : '성', r.x + r.w / 2, r.y + 33)

    if (rec?.cleared) {
      ctx.fillStyle = '#ffe066'
      ctx.font = '9px sans-serif'
      ctx.fillText('★', r.x + r.w / 2, r.y + 45)
    } else {
      ctx.fillStyle = 'rgba(255,255,255,.45)'
      ctx.font = '7px sans-serif'
      ctx.fillText('☆', r.x + r.w / 2, r.y + 45)
    }
  }

  ctx.fillStyle = 'rgba(255,255,255,.55)'
  ctx.font = '7px sans-serif'
  ctx.fillText('이전 탄을 깨면 다음 탄이 열립니다', VIEW_W / 2, VIEW_H - 7)
}
