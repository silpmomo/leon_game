import type { BestRecord, Rect } from '../types'
import { VIEW_H, VIEW_W } from '../engine/tuning'
import { GAMES, progressLabel, type GameEntry } from '../games/registry'
import { frame, type LoadedAtlas } from '../render/atlas'

/**
 * 게임 고르기 화면 (허브).
 *
 * 카드를 가로로 늘어놓는다. 게임이 늘어나면 registry 에 항목만 추가하면
 * 되도록 개수에 맞춰 카드 폭을 계산한다.
 */

const CARD_H = 96
const CARD_TOP = 58
const GAP = 14
const SIDE = 22
/** 카드 폭 상한. 게임이 둘뿐일 때 화면 폭을 다 쓰면 속이 비어 보인다. */
const CARD_MAX_W = 132

export function cardRect(index: number, count: number): Rect {
  const avail = VIEW_W - SIDE * 2 - GAP * (count - 1)
  const w = Math.min(CARD_MAX_W, Math.floor(avail / count))
  // 상한에 걸려 남는 폭은 양옆으로 나눠 가운데 정렬한다
  const rowW = w * count + GAP * (count - 1)
  const x0 = Math.round((VIEW_W - rowW) / 2)
  return { x: x0 + index * (w + GAP), y: CARD_TOP, w, h: CARD_H }
}

function inside(r: Rect, px: number, py: number): boolean {
  return px >= r.x && px <= r.x + r.w && py >= r.y && py <= r.y + r.h
}

/** 준비 중인 게임을 눌러도 null 을 준다 */
export function gameHitTest(px: number, py: number): string | null {
  for (let i = 0; i < GAMES.length; i++) {
    if (!inside(cardRect(i, GAMES.length), px, py)) continue
    const g = GAMES[i]!
    return g.status === 'ready' ? g.id : null
  }
  return null
}

/** 처음 만나는 플레이 가능한 게임. 키보드로 시작할 때 쓴다 */
export function firstReadyGame(): string | null {
  return GAMES.find((g) => g.status === 'ready')?.id ?? null
}

function drawThumb(
  ctx: CanvasRenderingContext2D,
  atlas: LoadedAtlas,
  g: GameEntry,
  cx: number,
  cy: number,
): void {
  const size = 34
  if (g.frame && atlas.image) {
    const f = frame(atlas.data, g.frame)
    if (f) {
      const h = Math.round((f.h / f.w) * size)
      ctx.drawImage(atlas.image, f.x, f.y, f.w, f.h, Math.round(cx - size / 2), Math.round(cy - h / 2), size, h)
      return
    }
  }
  ctx.font = '26px sans-serif'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillStyle = '#fff'
  ctx.fillText(g.emoji ?? '🎮', cx, cy)
}

export function drawGameSelect(
  ctx: CanvasRenderingContext2D,
  atlas: LoadedAtlas,
  records: Record<string, Record<string, BestRecord>>,
  totals: Record<string, number>,
): void {
  const sky = ctx.createLinearGradient(0, 0, 0, VIEW_H)
  sky.addColorStop(0, '#151d33')
  sky.addColorStop(1, '#2f4a70')
  ctx.fillStyle = sky
  ctx.fillRect(0, 0, VIEW_W, VIEW_H)

  // 배경 별
  ctx.fillStyle = 'rgba(255,255,255,.35)'
  for (let i = 0; i < 30; i++) {
    ctx.fillRect((i * 89) % VIEW_W, 6 + ((i * 47) % 44), 2, 2)
  }

  ctx.textAlign = 'center'
  ctx.textBaseline = 'alphabetic'
  ctx.fillStyle = '#fff'
  ctx.font = 'bold 18px sans-serif'
  ctx.fillText('게임 고르기', VIEW_W / 2, 32)
  ctx.font = '8px sans-serif'
  ctx.fillStyle = 'rgba(255,255,255,.7)'
  ctx.fillText('하고 싶은 게임을 눌러주세요', VIEW_W / 2, 46)

  for (let i = 0; i < GAMES.length; i++) {
    const g = GAMES[i]!
    const r = cardRect(i, GAMES.length)
    const ready = g.status === 'ready'

    // 카드 바탕
    ctx.fillStyle = ready ? 'rgba(255,255,255,.10)' : 'rgba(255,255,255,.05)'
    ctx.fillRect(r.x, r.y, r.w, r.h)
    ctx.lineWidth = 2
    ctx.strokeStyle = ready ? g.accent : 'rgba(255,255,255,.16)'
    ctx.strokeRect(r.x + 1, r.y + 1, r.w - 2, r.h - 2)

    // 위쪽 강조 띠
    ctx.fillStyle = ready ? g.accent : 'rgba(255,255,255,.14)'
    ctx.fillRect(r.x + 1, r.y + 1, r.w - 2, 4)

    ctx.save()
    if (!ready) ctx.globalAlpha = 0.45
    drawThumb(ctx, atlas, g, r.x + r.w / 2, r.y + 32)
    ctx.restore()

    ctx.textAlign = 'center'
    ctx.textBaseline = 'alphabetic'
    ctx.fillStyle = ready ? '#fff' : 'rgba(255,255,255,.5)'
    ctx.font = 'bold 11px sans-serif'
    ctx.fillText(g.title, r.x + r.w / 2, r.y + 62)

    ctx.font = '7px sans-serif'
    ctx.fillStyle = ready ? 'rgba(255,255,255,.8)' : 'rgba(255,255,255,.4)'
    ctx.fillText(g.subtitle, r.x + r.w / 2, r.y + 74)

    ctx.font = '7px monospace'
    ctx.fillStyle = ready ? g.accent : 'rgba(255,255,255,.35)'
    ctx.fillText(
      progressLabel(g, records[g.id] ?? {}, totals[g.id] ?? 0),
      r.x + r.w / 2,
      r.y + 87,
    )

    if (!ready) {
      ctx.font = '13px sans-serif'
      ctx.fillStyle = 'rgba(255,255,255,.55)'
      ctx.textBaseline = 'middle'
      ctx.fillText('🔒', r.x + r.w - 14, r.y + 16)
    }
  }
}
