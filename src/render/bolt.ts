import type { Bolt, GameState } from '../types'
import { VIEW_H, VIEW_W } from '../engine/tuning'

/**
 * 번개를 절차적으로 그린다.
 *
 * 16px 스프라이트로는 이 느낌이 안 난다. 지그재그 경로를 매 프레임 새로 만들고
 * 가느다란 선 세 겹(파란 글로우 → 노란 중간 → 흰 코어)으로 겹쳐 그린다.
 *
 * 굵기와 진폭의 관계가 핵심이다. 처음에 글로우를 빔 높이의 1.5배(15px)로 그리고
 * 진폭을 9px로 두었더니 흔들림이 굵기에 완전히 묻혀 흰 튜브가 되었다.
 * 선은 얇게(1~5px), 진폭은 굵기보다 훨씬 크게(±14px) 잡아야 번개로 보인다.
 *
 * 난수는 쓰지 않는다. 골든 리플레이 테스트가 결정적이어야 하고 렌더는 상태를
 * 바꾸지 않아야 하므로, 값을 (세그먼트 번호, 위상, 빔 좌표)에서 만든다.
 */

/** 결정적 해시 → [-1, 1] */
export function wobble(seed: number): number {
  const x = Math.sin(seed * 12.9898) * 43758.5453
  return (x - Math.floor(x)) * 2 - 1
}

export type Pt = { x: number; y: number }

/** 번개 진폭. 빔 히트박스 높이보다 크다 — 시각 효과는 판정보다 넓게 퍼진다. */
export const AMP = 11

/**
 * 몸통 세그먼트 수. 적을수록 긴 직선 구간과 급격한 꺾임이 생겨 번개처럼 보인다.
 * 18개로 잡았을 때는 6px마다 꺾여서 스프링처럼 보였다.
 */
export const SEGS = 7

/**
 * 지그재그 경로. 세그먼트마다 위아래를 번갈아 꺾어 각을 만든다.
 * 부드러운 노이즈만 쓰면 물결이 되고 번개로 보이지 않는다.
 */
export function boltPath(b: Bolt, segs: number, amp: number, phase: number): Pt[] {
  const y0 = b.y + b.h / 2
  const x0 = b.dir === 1 ? b.x : b.x + b.w
  const x1 = b.dir === 1 ? b.x + b.w : b.x
  const pts: Pt[] = []

  for (let i = 0; i <= segs; i++) {
    // x 간격을 불규칙하게 흔든다. 균등 간격이면 규칙적인 파형(스프링)처럼 보인다.
    const base = i / segs
    const jitter = i === 0 || i === segs ? 0 : wobble(i * 3.1 + phase) * 0.5 / segs
    const t = Math.max(0, Math.min(1, base + jitter))

    // 손에서 출발하는 첫 칸과 끝은 좁혀 붙는 느낌을 준다
    const taper = t < 0.1 ? t / 0.1 : t > 0.92 ? (1 - t) / 0.08 : 1
    const sign = i % 2 === 0 ? 1 : -1
    const mag = 0.55 + 0.45 * Math.abs(wobble(i * 7.3 + phase + b.x * 0.07))

    pts.push({
      x: x0 + (x1 - x0) * t,
      y: y0 + sign * amp * mag * taper,
    })
  }
  return pts
}

function stroke(
  ctx: CanvasRenderingContext2D,
  pts: Pt[],
  width: number,
  color: string,
): void {
  ctx.beginPath()
  ctx.moveTo(pts[0]!.x, pts[0]!.y)
  for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i]!.x, pts[i]!.y)
  ctx.lineWidth = width
  ctx.strokeStyle = color
  ctx.lineJoin = 'miter'
  ctx.lineCap = 'butt'
  ctx.stroke()
}

/** 월드 좌표계 안에서 그린다 (카메라 변환이 이미 걸린 상태) */
export function drawBolts(ctx: CanvasRenderingContext2D, s: GameState, tick: number): void {
  for (const b of s.bolts) {
    if (b.ms <= 0) continue

    // 수명 후반에 빠르게 사라진다
    const life = Math.max(0, Math.min(1, b.ms / b.totalMs))
    const fade = life > 0.45 ? 1 : life / 0.45
    const phase = tick * 5.7

    ctx.save()
    ctx.globalAlpha = fade

    // ① 파란 글로우 — 같은 경로를 넓게 한 번
    ctx.globalCompositeOperation = 'lighter'
    stroke(ctx, boltPath(b, SEGS, AMP, phase), 4, 'rgba(90,170,255,.28)')

    // ② 갈라지는 가지 — 몸통에서 뻗어 나가 사선으로 흩어진다
    for (let k = 0; k < 4; k++) {
      const frac = 0.25 + k * 0.18
      const startX = b.dir === 1 ? b.x + b.w * frac : b.x + b.w * (1 - frac)
      const len = b.w * (0.26 - k * 0.04)
      const branch: Bolt = {
        ...b,
        x: b.dir === 1 ? startX : startX - len,
        w: len,
        y: b.y + wobble(k * 3.7 + phase) * AMP * 0.7,
      }
      stroke(ctx, boltPath(branch, 3, AMP * 0.9, phase + k * 11), 1, 'rgba(170,215,255,.7)')
    }

    // ③ 노란 테두리와 흰 코어.
    //    노란 층을 가산합성으로 그리면 밝은 배경에서 흰색으로 날아간다.
    //    source-over 로 그려야 하늘색·용암색 어디서든 노란 번개로 보인다.
    const spine = boltPath(b, SEGS, AMP, phase)
    ctx.globalCompositeOperation = 'source-over'
    stroke(ctx, spine, 3, 'rgba(255,205,40,.9)')
    stroke(ctx, spine, 1, 'rgba(255,255,255,1)')

    // ④ 끝에서 튀는 스파크
    const tipX = b.dir === 1 ? b.x + b.w : b.x
    const tipY = b.y + b.h / 2
    ctx.fillStyle = 'rgba(255,250,190,.95)'
    for (let k = 0; k < 6; k++) {
      const a = wobble(k * 5.1 + phase) * Math.PI
      const r = 4 + Math.abs(wobble(k * 2.3 + phase)) * 10
      ctx.fillRect(Math.round(tipX + Math.cos(a) * r), Math.round(tipY + Math.sin(a) * r), 2, 2)
    }

    ctx.restore()
  }
}

/** 화면 전체 번쩍임. 카메라 변환 밖에서 그린다. */
export function drawFlash(ctx: CanvasRenderingContext2D, s: GameState): void {
  if (s.flashMs <= 0) return
  const a = Math.min(0.45, (s.flashMs / 90) * 0.45)
  ctx.fillStyle = `rgba(255,250,210,${a})`
  ctx.fillRect(0, 0, VIEW_W, VIEW_H)
}
