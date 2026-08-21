import type { LevelData, Progress, Rect, Theme } from '../types'
import { VIEW_H, VIEW_W } from '../engine/tuning'
import { isUnlocked } from '../game/unlock'
import { STAGES_PER_WORLD } from '../levels/index'

const COLS = 5
const CELL = 46
const GAP_X = 9
const GAP_Y = 10
const TOP = 62

export const BACK_RECT: Rect = { x: 6, y: 6, w: 44, h: 15 }

const TAB_W = 52
const TAB_H = 17
const TAB_Y = 40

function gridOrigin(): { x: number; y: number } {
  const totalW = COLS * CELL + (COLS - 1) * GAP_X
  return { x: Math.round((VIEW_W - totalW) / 2), y: TOP }
}

/** 월드 안에서의 자리(0~9)로 칸 위치를 구한다 */
export function cellRect(slot: number): Rect {
  const o = gridOrigin()
  const c = slot % COLS
  const r = Math.floor(slot / COLS)
  return { x: o.x + c * (CELL + GAP_X), y: o.y + r * (CELL + GAP_Y), w: CELL, h: CELL }
}

export function worldTabRect(world: number, worldCount: number): Rect {
  const totalW = worldCount * TAB_W + (worldCount - 1) * 8
  const x0 = Math.round((VIEW_W - totalW) / 2)
  return { x: x0 + world * (TAB_W + 8), y: TAB_Y, w: TAB_W, h: TAB_H }
}

function inside(r: Rect, px: number, py: number): boolean {
  return px >= r.x && px <= r.x + r.w && py >= r.y && py <= r.y + r.h
}

/**
 * 월드 탭 클릭 판정. 첫 탄이 잠긴 월드는 고를 수 없다.
 * 2월드는 1-10 을 깨야 열린다 — 잠금 규칙이 평평한 목록 위에서 그대로 동작한다.
 */
export function worldTabHitTest(
  px: number,
  py: number,
  stages: readonly LevelData[],
  progress: Progress,
  worldCount: number,
): number | null {
  const ids = stages.map((s) => s.id)
  for (let w = 0; w < worldCount; w++) {
    if (!inside(worldTabRect(w, worldCount), px, py)) continue
    return isUnlocked(ids, w * STAGES_PER_WORLD, progress) ? w : null
  }
  return null
}

/** 잠긴 칸을 눌러도 null 을 준다. 반환값은 전체 목록의 인덱스다. */
export function stageHitTest(
  px: number,
  py: number,
  stages: readonly LevelData[],
  progress: Progress,
  world: number,
): number | null {
  const ids = stages.map((s) => s.id)
  for (let slot = 0; slot < STAGES_PER_WORLD; slot++) {
    if (!inside(cellRect(slot), px, py)) continue
    const index = world * STAGES_PER_WORLD + slot
    if (index >= stages.length) return null
    return isUnlocked(ids, index, progress) ? index : null
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
  ice: '#5aa8c0',
}

const THEME_LABEL: Record<Theme, string> = {
  day: '지상',
  underground: '지하',
  night: '밤',
  castle: '성',
  ice: '얼음',
}

export function drawStageSelect(
  ctx: CanvasRenderingContext2D,
  stages: readonly LevelData[],
  progress: Progress,
  modeLabel: string,
  world: number,
  worldCount: number,
): void {
  const sky = ctx.createLinearGradient(0, 0, 0, VIEW_H)
  sky.addColorStop(0, '#1d2b45')
  sky.addColorStop(1, '#3f5f86')
  ctx.fillStyle = sky
  ctx.fillRect(0, 0, VIEW_W, VIEW_H)

  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'

  // 뒤로 가기
  ctx.fillStyle = 'rgba(255,255,255,.18)'
  ctx.fillRect(BACK_RECT.x, BACK_RECT.y, BACK_RECT.w, BACK_RECT.h)
  ctx.fillStyle = '#fff'
  ctx.font = 'bold 8px sans-serif'
  ctx.fillText('← 처음', BACK_RECT.x + BACK_RECT.w / 2, BACK_RECT.y + BACK_RECT.h / 2 + 1)

  const ids = stages.map((s) => s.id)
  const cleared = ids.filter((id) => progress[id]?.cleared).length

  ctx.font = 'bold 12px sans-serif'
  ctx.fillText(`탄 고르기 · ${modeLabel}`, VIEW_W / 2, 16)
  ctx.font = '8px monospace'
  ctx.fillStyle = 'rgba(255,255,255,.75)'
  ctx.fillText(`${cleared} / ${stages.length} 클리어`, VIEW_W / 2, 29)

  // 월드 탭
  for (let w = 0; w < worldCount; w++) {
    const r = worldTabRect(w, worldCount)
    const open = isUnlocked(ids, w * STAGES_PER_WORLD, progress)
    const on = w === world
    ctx.fillStyle = on ? 'rgba(255,255,255,.92)' : open ? 'rgba(255,255,255,.22)' : 'rgba(255,255,255,.08)'
    ctx.fillRect(r.x, r.y, r.w, r.h)
    ctx.fillStyle = on ? '#1d2b45' : open ? '#fff' : 'rgba(255,255,255,.4)'
    ctx.font = 'bold 9px sans-serif'
    ctx.fillText(open ? `${w + 1}월드` : `🔒 ${w + 1}`, r.x + r.w / 2, r.y + r.h / 2 + 1)
  }

  // 탄 격자
  for (let slot = 0; slot < STAGES_PER_WORLD; slot++) {
    const index = world * STAGES_PER_WORLD + slot
    const st = stages[index]
    if (!st) continue
    const r = cellRect(slot)
    const open = isUnlocked(ids, index, progress)
    const rec = progress[st.id]

    ctx.fillStyle = open ? THEME_TINT[st.theme] : 'rgba(255,255,255,.10)'
    ctx.fillRect(r.x, r.y, r.w, r.h)
    ctx.lineWidth = 2
    ctx.strokeStyle = open ? 'rgba(255,255,255,.85)' : 'rgba(255,255,255,.22)'
    ctx.strokeRect(r.x + 1, r.y + 1, r.w - 2, r.h - 2)

    if (!open) {
      ctx.fillStyle = 'rgba(255,255,255,.5)'
      ctx.font = '15px sans-serif'
      ctx.fillText('🔒', r.x + r.w / 2, r.y + r.h / 2)
      continue
    }

    ctx.fillStyle = '#fff'
    ctx.font = 'bold 14px sans-serif'
    ctx.fillText(st.name, r.x + r.w / 2, r.y + 16)
    ctx.font = '7px sans-serif'
    ctx.fillStyle = 'rgba(255,255,255,.85)'
    ctx.fillText(THEME_LABEL[st.theme], r.x + r.w / 2, r.y + 29)

    if (rec?.cleared) {
      ctx.fillStyle = '#ffe066'
      ctx.font = '9px sans-serif'
      ctx.fillText('★', r.x + r.w / 2, r.y + 39)
    } else {
      ctx.fillStyle = 'rgba(255,255,255,.45)'
      ctx.font = '7px sans-serif'
      ctx.fillText('☆', r.x + r.w / 2, r.y + 39)
    }
  }

  ctx.fillStyle = 'rgba(255,255,255,.55)'
  ctx.font = '7px sans-serif'
  ctx.fillText('이전 탄을 깨면 다음 탄이 열립니다', VIEW_W / 2, VIEW_H - 6)
}
