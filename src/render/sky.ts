import type {
  Beam, BossShape, BulletHue, SkyBoss, SkyEnemy, SkyState, SkyTheme,
} from '../sky/types'
import { BOMB, SKY_H, SKY_W } from '../sky/tuning'
import { beamLength, beamLive, bulletX, bulletY } from '../sky/bullets'
import { bossHpRatio, bossPhase } from '../sky/boss'
import { frame, type LoadedAtlas } from './atlas'
import { wobble } from './bolt'

/**
 * 하늘전투 렌더러.
 *
 * 보스는 도트가 아니라 여기서 도형으로 그린다 — 10마리를 프레임으로 찍는
 * 대신 BossShape 파라미터를 해석한다. 페이즈마다 형태가 바뀌는 연출도
 * 색과 팔 개수만 갈아끼우면 된다.
 */

type ThemeSkin = {
  top: string
  bot: string
  far: string
  near: string
  ground: string
  stars: boolean
}

const THEMES: Record<SkyTheme, ThemeSkin> = {
  dawn: { top: '#ffd3a0', bot: '#7fc4e8', far: '#e8a06a', near: '#a8703c', ground: '#6b8f3c', stars: false },
  cloud: { top: '#9fd8f5', bot: '#dff1ff', far: '#ffffff', near: '#cfe6f5', ground: '#8fb8d8', stars: false },
  forest: { top: '#8fd0f0', bot: '#cfeaa8', far: '#4f8f3f', near: '#2f6b2a', ground: '#245223', stars: false },
  storm: { top: '#3c4658', bot: '#6b7a92', far: '#2a3242', near: '#1c222e', ground: '#161b24', stars: false },
  volcano: { top: '#5a1f14', bot: '#e0602c', far: '#8c2f14', near: '#3c1408', ground: '#2a0d05', stars: false },
  night: { top: '#101a3a', bot: '#2a2f6b', far: '#1a2350', near: '#0c1130', ground: '#080b22', stars: true },
  ice: { top: '#bfe8ff', bot: '#eaf7ff', far: '#8fc4e0', near: '#5f95b8', ground: '#4a7a98', stars: false },
  desert: { top: '#f0c878', bot: '#e8a04a', far: '#c88a3a', near: '#9a6528', ground: '#7a4f1c', stars: false },
  steam: { top: '#4a4a58', bot: '#8a8a98', far: '#3a3a46', near: '#26262e', ground: '#1a1a20', stars: false },
  castle: { top: '#2a1a4a', bot: '#7a4a9a', far: '#3f2a6a', near: '#241540', ground: '#1a0e30', stars: true },
}

/** 궁극기 연출 길이. tuning 의 BOMB.ms 와 반드시 같아야 한다 */
const BOMB_FX_MS = BOMB.ms

const HUE: Record<BulletHue, [string, string]> = {
  pink: ['#ff4f86', '#ffd0e0'],
  blue: ['#4fb2ff', '#d8efff'],
  amber: ['#ffb02e', '#fff0c8'],
  violet: ['#b06cff', '#ecd8ff'],
  lime: ['#8fe63c', '#e8ffd0'],
}

function px(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, c: string): void {
  ctx.fillStyle = c
  ctx.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h))
}

function sprite(
  ctx: CanvasRenderingContext2D,
  atlas: LoadedAtlas,
  name: string,
  cx: number,
  cy: number,
  fallback: string,
): void {
  const f = frame(atlas.data, name)
  if (!f || !atlas.image) {
    px(ctx, cx - 6, cy - 5, 12, 10, fallback)
    return
  }
  ctx.drawImage(
    atlas.image, f.x, f.y, f.w, f.h,
    Math.round(cx - f.w / 2), Math.round(cy - f.h / 2), f.w, f.h,
  )
}

// ── 배경 ──────────────────────────────────────────────────────

function drawBackground(ctx: CanvasRenderingContext2D, s: SkyState): void {
  const th = THEMES[s.stage.theme]
  const g = ctx.createLinearGradient(0, 0, 0, SKY_H)
  g.addColorStop(0, th.top)
  g.addColorStop(1, th.bot)
  ctx.fillStyle = g
  ctx.fillRect(0, 0, SKY_W, SKY_H)

  if (th.stars) {
    ctx.fillStyle = 'rgba(255,255,255,.7)'
    for (let i = 0; i < 44; i++) {
      const x = (i * 97 - s.scroll * 0.12) % (SKY_W + 20)
      const wx = x < 0 ? x + SKY_W + 20 : x
      ctx.fillRect(Math.round(wx), 4 + ((i * 53) % 120), 1, 1)
    }
  }

  // 먼 산 — 사인 두 개를 겹쳐 결정적으로 만든다
  ctx.fillStyle = th.far
  ctx.beginPath()
  ctx.moveTo(0, SKY_H)
  for (let x = 0; x <= SKY_W; x += 8) {
    const w = x + s.scroll * 0.2
    const y = SKY_H - 34 - Math.sin(w / 61) * 12 - Math.sin(w / 23) * 5
    ctx.lineTo(x, y)
  }
  ctx.lineTo(SKY_W, SKY_H)
  ctx.closePath()
  ctx.fill()

  // 가까운 산
  ctx.fillStyle = th.near
  ctx.beginPath()
  ctx.moveTo(0, SKY_H)
  for (let x = 0; x <= SKY_W; x += 6) {
    const w = x + s.scroll * 0.55
    const y = SKY_H - 16 - Math.sin(w / 37) * 9 - Math.sin(w / 13) * 3
    ctx.lineTo(x, y)
  }
  ctx.lineTo(SKY_W, SKY_H)
  ctx.closePath()
  ctx.fill()

  // 바닥 띠 — 포탑이 여기 붙어 있는 것처럼 보인다
  px(ctx, 0, SKY_H - 8, SKY_W, 8, th.ground)
  ctx.fillStyle = 'rgba(255,255,255,.10)'
  for (let i = 0; i < 26; i++) {
    const x = (i * 17 - (s.scroll % 17)) % SKY_W
    ctx.fillRect(Math.round(x < 0 ? x + SKY_W : x), SKY_H - 8, 6, 1)
  }

  // 흘러가는 구름
  ctx.fillStyle = 'rgba(255,255,255,.22)'
  for (let i = 0; i < 6; i++) {
    const span = SKY_W + 120
    let x = (i * 91 - s.scroll * 0.42) % span
    if (x < -60) x += span
    const y = 16 + ((i * 41) % 70)
    ctx.beginPath()
    ctx.ellipse(x, y, 26, 7, 0, 0, Math.PI * 2)
    ctx.fill()
  }
}

// ── 플레이어 ──────────────────────────────────────────────────

function bodyFrame(tilt: number, tick: number): string {
  if (tilt < -0.3) return 'skyBody0'
  if (tilt > 0.3) return 'skyBody2'
  // 평평할 때는 망토가 펄럭이게 순환시킨다
  return ['skyBody1', 'skyBody0', 'skyBody1', 'skyBody2'][Math.floor(tick / 6) % 4]!
}

function drawPlayer(
  ctx: CanvasRenderingContext2D, s: SkyState, atlas: LoadedAtlas, tick: number,
): void {
  const p = s.player
  if (!p.alive) return
  // 무적 동안 깜빡인다. 완전히 사라지면 어디 있는지 놓친다
  if (p.invMs > 0 && Math.floor(tick / 3) % 2 === 0) ctx.globalAlpha = 0.35

  // 뒤로 끌리는 바람 자국
  ctx.fillStyle = 'rgba(255,255,255,.30)'
  for (let i = 1; i <= 3; i++) {
    ctx.fillRect(Math.round(p.x - 14 - i * 5), Math.round(p.y + 2), 4, 1)
  }

  sprite(ctx, atlas, bodyFrame(p.tilt, tick), p.x - 2, p.y + 3, '#4bc0ae')

  // 얼굴 — 기존 게임과 같은 사진 스프라이트를 그대로 쓴다
  const f = frame(atlas.data, 'face')
  if (f && atlas.image) {
    const fw = 12
    const fh = Math.round((f.h / f.w) * fw)
    // 어깨에 2px 묻어 목이 끊겨 보이지 않게 한다
    ctx.drawImage(
      atlas.image, f.x, f.y, f.w, f.h,
      Math.round(p.x - 1), Math.round(p.y - fh + 5), fw, fh,
    )
  } else {
    px(ctx, p.x - 1, p.y - 9, 12, 13, '#f0c9a4')
  }

  if (p.stunMs > 0) {
    ctx.fillStyle = '#ffe066'
    for (let i = 0; i < 3; i++) {
      const a = tick / 4 + (i / 3) * Math.PI * 2
      ctx.fillRect(Math.round(p.x + Math.cos(a) * 12), Math.round(p.y - 12 + Math.sin(a) * 4), 2, 2)
    }
  }

  ctx.globalAlpha = 1

  // 옵션(사역마)
  for (const o of s.options) {
    ctx.globalCompositeOperation = 'lighter'
    ctx.fillStyle = 'rgba(90,220,255,.55)'
    ctx.beginPath()
    ctx.arc(o.x, o.y, 4.5, 0, Math.PI * 2)
    ctx.fill()
    ctx.globalCompositeOperation = 'source-over'
    ctx.fillStyle = '#eaffff'
    ctx.beginPath()
    ctx.arc(o.x, o.y, 2, 0, Math.PI * 2)
    ctx.fill()
  }
}

// ── 탄 ────────────────────────────────────────────────────────

function drawShots(ctx: CanvasRenderingContext2D, s: SkyState, atlas: LoadedAtlas): void {
  for (const sh of s.shots) {
    if (sh.homing) {
      sprite(ctx, atlas, 'skyMissile', sh.x, sh.y, '#ffffff')
      continue
    }
    sprite(ctx, atlas, 'skyShot', sh.x, sh.y, '#ffe066')
  }
}

function drawBullets(ctx: CanvasRenderingContext2D, s: SkyState): void {
  // 큰 탄만 발광시킨다. 모든 탄에 걸면 밝은 배경에서 하얗게 뭉친다
  ctx.globalCompositeOperation = 'lighter'
  ctx.globalAlpha = 0.5
  for (const b of s.bullets) {
    if (!b.big) continue
    ctx.fillStyle = HUE[b.hue][0]
    ctx.beginPath()
    ctx.arc(bulletX(b), bulletY(b), b.r + 3, 0, Math.PI * 2)
    ctx.fill()
  }
  ctx.globalAlpha = 1
  ctx.globalCompositeOperation = 'source-over'

  for (const b of s.bullets) {
    const [outer, inner] = HUE[b.hue]
    const x = bulletX(b)
    const y = bulletY(b)
    // 어두운 테두리. 아침 들판처럼 밝은 배경에서는 이게 없으면 탄이 안 보인다
    ctx.fillStyle = 'rgba(18,10,28,.55)'
    ctx.beginPath()
    ctx.arc(x, y, b.r + 1.1, 0, Math.PI * 2)
    ctx.fill()
    ctx.fillStyle = outer
    ctx.beginPath()
    ctx.arc(x, y, b.r, 0, Math.PI * 2)
    ctx.fill()
    // 흰 심 — 어느 배경에서도 탄의 중심이 보이게
    ctx.fillStyle = inner
    ctx.beginPath()
    ctx.arc(x, y, b.r * 0.45, 0, Math.PI * 2)
    ctx.fill()
  }
}

function drawBeam(ctx: CanvasRenderingContext2D, s: Beam, tick: number): void {
  const [outer, inner] = HUE[s.hue]
  const len = beamLength()
  const ex = s.x + Math.cos(s.angle) * len
  const ey = s.y + Math.sin(s.angle) * len

  ctx.save()
  if (!beamLive(s)) {
    // 예고선. 얇게, 깜빡이며
    ctx.globalAlpha = 0.5 + 0.35 * Math.sin(tick / 2)
    ctx.strokeStyle = outer
    ctx.lineWidth = 2
    ctx.setLineDash([7, 5])
    ctx.beginPath()
    ctx.moveTo(s.x, s.y)
    ctx.lineTo(ex, ey)
    ctx.stroke()
    ctx.restore()
    return
  }

  const fade = Math.min(1, (s.age - s.warnMs) / 90)
  ctx.globalCompositeOperation = 'lighter'
  ctx.globalAlpha = 0.7
  ctx.strokeStyle = outer
  ctx.lineWidth = s.half * 2 * fade
  ctx.beginPath()
  ctx.moveTo(s.x, s.y)
  ctx.lineTo(ex, ey)
  ctx.stroke()
  ctx.globalCompositeOperation = 'source-over'
  ctx.globalAlpha = 1
  ctx.strokeStyle = inner
  ctx.lineWidth = Math.max(1, s.half * 0.7 * fade)
  ctx.beginPath()
  ctx.moveTo(s.x, s.y)
  ctx.lineTo(ex, ey)
  ctx.stroke()
  ctx.restore()
}

// ── 적 ────────────────────────────────────────────────────────

const ENEMY_FRAME: Record<SkyEnemy['kind'], [string, string]> = {
  bird: ['skyBird0', 'skyBird1'],
  bee: ['skyBee0', 'skyBee1'],
  kite: ['skyKite0', 'skyKite1'],
  ufo: ['skyUfo0', 'skyUfo1'],
  rocket: ['skyRocket0', 'skyRocket1'],
  turret: ['skyTurret0', 'skyTurret1'],
  blimp: ['skyBlimp0', 'skyBlimp1'],
}

function drawEnemies(
  ctx: CanvasRenderingContext2D, s: SkyState, atlas: LoadedAtlas, tick: number,
): void {
  for (const e of s.enemies) {
    if (!e.alive) continue
    const pair = ENEMY_FRAME[e.kind]
    const speedy = e.kind === 'bird' || e.kind === 'bee'
    const i = Math.floor(tick / (speedy ? 4 : 9)) % 2
    // 도트는 전부 오른쪽을 보게 찍혀 있다. 왼쪽으로 날아가므로 뒤집는다
    ctx.save()
    ctx.translate(Math.round(e.x) * 2, 0)
    ctx.scale(-1, 1)
    sprite(ctx, atlas, pair[i]!, e.x, e.y, '#cc6688')
    ctx.restore()
    if (e.hitMs > 0) {
      ctx.globalCompositeOperation = 'lighter'
      ctx.globalAlpha = 0.55
      px(ctx, e.x - e.w / 2, e.y - e.h / 2, e.w, e.h, '#ffffff')
      ctx.globalAlpha = 1
      ctx.globalCompositeOperation = 'source-over'
    }
  }
}

// ── 보스 ──────────────────────────────────────────────────────

function eye(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, c: string): void {
  ctx.fillStyle = c
  ctx.beginPath()
  ctx.arc(x, y, r, 0, Math.PI * 2)
  ctx.fill()
  ctx.fillStyle = '#14110f'
  ctx.beginPath()
  ctx.arc(x - r * 0.2, y, r * 0.42, 0, Math.PI * 2)
  ctx.fill()
}

/**
 * 보스 도형은 항상 어두운 외곽선을 두른다.
 * 얼음 골짜기·구름 바다처럼 배경이 밝은 탄에서는 이게 없으면 보스가
 * 배경에 녹아 어디까지가 몸인지 안 보인다.
 */
const EDGE = 'rgba(18,12,10,.72)'

function ell(
  ctx: CanvasRenderingContext2D, x: number, y: number,
  rx: number, ry: number, c: string, rot = 0,
): void {
  ctx.fillStyle = c
  ctx.beginPath()
  ctx.ellipse(x, y, rx, ry, rot, 0, Math.PI * 2)
  ctx.fill()
  ctx.lineWidth = 1
  ctx.strokeStyle = EDGE
  ctx.stroke()
}

function poly(ctx: CanvasRenderingContext2D, pts: number[][], c: string): void {
  ctx.fillStyle = c
  ctx.beginPath()
  ctx.moveTo(pts[0]![0]!, pts[0]![1]!)
  for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i]![0]!, pts[i]![1]!)
  ctx.closePath()
  ctx.fill()
  ctx.lineWidth = 1
  ctx.strokeStyle = EDGE
  ctx.stroke()
}

/** 보스 몸통. shape.body 마다 다른 실루엣을 그린다 */
function drawBossBody(
  ctx: CanvasRenderingContext2D, b: SkyBoss, sh: BossShape, tick: number,
): void {
  const { x, y } = b
  const w = b.w
  const h = b.h
  const flap = Math.sin(tick / 7)
  const arms = sh.arms

  switch (sh.body) {
    case 'bird': {
      // 날개가 위아래로 크게 퍼덕인다
      for (const dir of [-1, 1]) {
        poly(ctx, [
          [x + 4, y],
          [x - w * 0.45, y + dir * (h * 0.5 + flap * 6)],
          [x + w * 0.3, y + dir * h * 0.18],
        ], sh.sub)
      }
      ell(ctx, x, y, w * 0.36, h * 0.34, sh.main)
      poly(ctx, [
        [x - w * 0.4, y - 5], [x - w * 0.62, y], [x - w * 0.4, y + 5],
      ], sh.sub)
      poly(ctx, [
        [x + w * 0.3, y - 4], [x + w * 0.56, y], [x + w * 0.3, y + 4],
      ], '#ffca3a')
      eye(ctx, x + w * 0.12, y - 4, 4, sh.eye)
      break
    }

    case 'whale': {
      ell(ctx, x, y, w * 0.48, h * 0.4, sh.main)
      ell(ctx, x - w * 0.1, y + h * 0.14, w * 0.36, h * 0.2, sh.sub)
      poly(ctx, [
        [x - w * 0.42, y],
        [x - w * 0.62, y - h * 0.42 - flap * 4],
        [x - w * 0.62, y + h * 0.42 + flap * 4],
      ], sh.sub)
      for (let i = 0; i < arms + 2; i++) {
        px(ctx, x - w * 0.3 + i * 7, y + h * 0.22, 4, 2, sh.eye)
      }
      eye(ctx, x + w * 0.28, y - h * 0.1, 4.5, sh.eye)
      break
    }

    case 'golem': {
      // 팔이 몸통 옆에서 천천히 오르내린다
      for (let i = 0; i < arms; i++) {
        const a = (i / arms) * Math.PI * 2 + tick / 40
        ell(ctx, x + Math.cos(a) * w * 0.5, y + Math.sin(a) * h * 0.42, 7, 7, sh.sub)
      }
      px(ctx, x - w * 0.38, y - h * 0.4, w * 0.76, h * 0.8, sh.main)
      px(ctx, x - w * 0.26, y - h * 0.26, w * 0.52, h * 0.3, sh.sub)
      eye(ctx, x - 8, y - h * 0.12, 4, sh.eye)
      eye(ctx, x + 8, y - h * 0.12, 4, sh.eye)
      break
    }

    case 'lizard': {
      ell(ctx, x + w * 0.06, y, w * 0.44, h * 0.34, sh.main)
      poly(ctx, [
        [x - w * 0.35, y - 4], [x - w * 0.62, y + flap * 5], [x - w * 0.35, y + 4],
      ], sh.sub)
      // 등지느러미
      for (let i = 0; i < arms + 2; i++) {
        const sx = x - w * 0.3 + i * (w * 0.6 / (arms + 2))
        poly(ctx, [
          [sx, y - h * 0.24], [sx + 4, y - h * 0.52], [sx + 8, y - h * 0.24],
        ], sh.sub)
      }
      poly(ctx, [
        [x + w * 0.3, y - 6], [x + w * 0.6, y + 2], [x + w * 0.3, y + 8],
      ], sh.main)
      eye(ctx, x + w * 0.26, y - 4, 4, sh.eye)
      break
    }

    case 'crown': {
      // 주위를 도는 팔 — 페이즈가 오를수록 늘어난다
      for (let i = 0; i < arms; i++) {
        const a = (i / arms) * Math.PI * 2 + tick / 26
        ell(ctx, x + Math.cos(a) * w * 0.56, y + Math.sin(a) * h * 0.46, 6, 6, sh.sub)
      }
      poly(ctx, [
        [x, y - h * 0.46], [x + w * 0.4, y], [x, y + h * 0.46], [x - w * 0.4, y],
      ], sh.main)
      poly(ctx, [
        [x, y - h * 0.28], [x + w * 0.24, y], [x, y + h * 0.28], [x - w * 0.24, y],
      ], sh.sub)
      // 왕관 — 마름모 윗면을 따라 붙인다. 고정 높이로 두면 공중에 떠 보인다
      for (let i = -1; i <= 1; i++) {
        const bx = x + i * (w * 0.13)
        const top = y - h * 0.46 + Math.abs(i) * (h * 0.12)
        poly(ctx, [[bx - 3, top], [bx, top - 9], [bx + 3, top]], '#ffd166')
      }
      eye(ctx, x + 2, y, 5, sh.eye)
      break
    }

    case 'machine': {
      px(ctx, x - w * 0.42, y - h * 0.36, w * 0.84, h * 0.72, sh.main)
      px(ctx, x - w * 0.3, y - h * 0.22, w * 0.6, h * 0.44, sh.sub)
      for (let i = 0; i < arms; i++) {
        const oy = -h * 0.3 + (i / Math.max(1, arms - 1)) * h * 0.6
        px(ctx, x - w * 0.56 - Math.abs(flap) * 3, y + oy - 2, w * 0.16, 5, sh.sub)
      }
      // 리벳
      for (let i = 0; i < 5; i++) {
        px(ctx, x - w * 0.36 + i * 9, y - h * 0.32, 2, 2, '#e8e8f0')
        px(ctx, x - w * 0.36 + i * 9, y + h * 0.28, 2, 2, '#e8e8f0')
      }
      ctx.globalCompositeOperation = 'lighter'
      ell(ctx, x, y, 9 + Math.abs(flap) * 3, 9 + Math.abs(flap) * 3, sh.eye)
      ctx.globalCompositeOperation = 'source-over'
      eye(ctx, x, y, 5, '#fff6d0')
      break
    }

    case 'orb':
    default: {
      for (let i = 0; i < arms; i++) {
        const a = (i / arms) * Math.PI * 2 + tick / 22
        ell(ctx, x + Math.cos(a) * w * 0.6, y + Math.sin(a) * h * 0.5, 5.5, 5.5, sh.sub)
      }
      ell(ctx, x, y, w * 0.4, h * 0.4, sh.main)
      ell(ctx, x - w * 0.1, y - h * 0.1, w * 0.24, h * 0.22, sh.sub)
      eye(ctx, x + 3, y + 2, 6, sh.eye)
      break
    }
  }
}

function drawBoss(ctx: CanvasRenderingContext2D, s: SkyState, tick: number): void {
  const b = s.boss
  if (!b || !b.alive) return
  const sh = bossPhase(b).shape

  ctx.save()
  if (b.dieMs > 0) {
    // 격파 — 하얗게 타면서 흔들린다
    ctx.globalAlpha = 0.4 + 0.6 * ((b.dieMs / 600) % 1)
    ctx.translate(wobble(tick) * 3, wobble(tick + 9) * 3)
  } else if (b.morphMs > 0) {
    ctx.globalAlpha = 0.55 + 0.45 * Math.sin(tick / 2)
  } else if (b.enterMs > 0) {
    ctx.globalAlpha = 0.9
  }

  // 보스도 왼쪽(플레이어 쪽)을 본다.
  // setTransform 으로 되돌리면 바깥의 화면 흔들림·배율까지 지워진다. save/restore 로만 다룬다
  ctx.save()
  ctx.translate(b.x * 2, 0)
  ctx.scale(-1, 1)
  drawBossBody(ctx, b, sh, tick)
  ctx.restore()

  if (b.hitMs > 0) {
    ctx.globalCompositeOperation = 'lighter'
    ctx.globalAlpha = 0.4
    ell(ctx, b.x, b.y, b.w * 0.4, b.h * 0.4, '#ffffff')
    ctx.globalAlpha = 1
    ctx.globalCompositeOperation = 'source-over'
  }
  ctx.restore()

  if (b.dieMs > 0) {
    ctx.globalCompositeOperation = 'lighter'
    for (let i = 0; i < 6; i++) {
      const a = tick / 5 + i
      const r = 10 + ((tick * 2 + i * 30) % 60)
      ctx.fillStyle = 'rgba(255,220,140,.5)'
      ctx.beginPath()
      ctx.arc(b.x + Math.cos(a) * r, b.y + Math.sin(a) * r, 4, 0, Math.PI * 2)
      ctx.fill()
    }
    ctx.globalCompositeOperation = 'source-over'
  }
}

// ── 아이템·연출 ───────────────────────────────────────────────

const ITEM_FRAME = { power: 'skyPower', bomb: 'skyBomb', coin: 'skyCoin' } as const

function drawItems(
  ctx: CanvasRenderingContext2D, s: SkyState, atlas: LoadedAtlas, tick: number,
): void {
  for (const it of s.items) {
    // 반짝여서 눈에 띄게
    if (Math.floor(tick / 5) % 6 === 0) {
      ctx.globalCompositeOperation = 'lighter'
      ctx.globalAlpha = 0.5
    }
    sprite(ctx, atlas, ITEM_FRAME[it.kind], it.x, it.y, '#ffd166')
    ctx.globalAlpha = 1
    ctx.globalCompositeOperation = 'source-over'
  }
}

function drawBursts(ctx: CanvasRenderingContext2D, s: SkyState): void {
  ctx.globalCompositeOperation = 'lighter'
  for (const b of s.bursts) {
    const k = b.age / b.life
    const r = b.r * (0.3 + k * 0.9)
    ctx.globalAlpha = (1 - k) * 0.8
    ctx.fillStyle = b.hue === 'white' ? '#ffffff' : HUE[b.hue][0]
    ctx.beginPath()
    ctx.arc(b.x, b.y, r, 0, Math.PI * 2)
    ctx.fill()
  }
  ctx.globalAlpha = 1
  ctx.globalCompositeOperation = 'source-over'
}

/**
 * 궁극기 — 기존 게임의 100만볼트와 같은 결로 그린다.
 *
 * bolt.ts 에서 배운 것을 그대로 지킨다: 선은 얇게, 진폭은 굵기보다 훨씬 크게,
 * 세그먼트는 적게, 꺾임은 위아래를 번갈아. 부드러운 노이즈만 얹으면
 * 번개가 아니라 파란 호스가 된다. 가산 합성도 쓰지 않는다 —
 * 얼음 골짜기처럼 흰 배경에서는 통째로 사라진다.
 */
function drawBombFx(ctx: CanvasRenderingContext2D, s: SkyState, tick: number): void {
  if (s.bombMs <= 0) return
  const p = s.player
  const k = s.bombMs / BOMB_FX_MS
  const grow = 1 - k

  ctx.save()
  ctx.lineCap = 'round'
  ctx.lineJoin = 'miter'

  const ARMS = 7
  const SEGS = 5
  for (let i = 0; i < ARMS; i++) {
    // 회전까지 시키면 팔끼리 엉켜 실뭉치가 된다. 각도는 고정한다
    const a = (i / ARMS) * Math.PI * 2 + wobble(i * 2.3) * 0.25
    // 팔마다 길이를 달리해야 방사형 도형이 아니라 번개로 보인다
    const reach = (0.35 + 0.65 * Math.abs(wobble(i * 5.7))) * SKY_W * 0.8 * grow + 20
    const pts: [number, number][] = []
    for (let j = 0; j <= SEGS; j++) {
      const t = j / SEGS
      // 끝으로 갈수록 좁아지게 — 손끝에서 뻗어 나가는 느낌
      const taper = t < 0.12 ? t / 0.12 : t > 0.9 ? (1 - t) / 0.1 : 1
      const sign = j % 2 === 0 ? 1 : -1
      const mag = 0.5 + 0.5 * Math.abs(wobble(i * 9.1 + j * 3.7 + Math.floor(tick / 2)))
      // 진폭을 길이에 비례시킨다. 고정 24px 이면 짧은 팔이 뭉개진다
      const off = j === 0 ? 0 : sign * reach * 0.11 * mag * taper
      const rr = reach * t
      pts.push([
        p.x + Math.cos(a) * rr - Math.sin(a) * off,
        p.y + Math.sin(a) * rr + Math.cos(a) * off,
      ])
    }
    for (const [wd, col] of [
      [3, 'rgba(40,90,200,.4)'],
      [1.8, 'rgba(120,190,255,.95)'],
      [0.9, '#ffffff'],
    ] as const) {
      ctx.lineWidth = wd
      ctx.strokeStyle = col
      ctx.beginPath()
      ctx.moveTo(pts[0]![0], pts[0]![1])
      for (let j = 1; j < pts.length; j++) ctx.lineTo(pts[j]![0], pts[j]![1])
      ctx.stroke()
    }
  }

  // 퍼져 나가는 충격 고리
  ctx.lineWidth = 2
  ctx.strokeStyle = `rgba(150,210,255,${(1 - grow) * 0.8})`
  ctx.beginPath()
  ctx.arc(p.x, p.y, 20 + grow * 210, 0, Math.PI * 2)
  ctx.stroke()
  ctx.restore()

  if (s.flashMs > 0) {
    // 흰 섬광만 쓰면 밝은 배경에서 티가 안 난다. 푸른 기를 섞는다
    ctx.fillStyle = `rgba(190,225,255,${(s.flashMs / 260) * 0.6})`
    ctx.fillRect(0, 0, SKY_W, SKY_H)
  }
}

// ── HUD ───────────────────────────────────────────────────────

export function drawSkyHud(ctx: CanvasRenderingContext2D, s: SkyState): void {
  ctx.textBaseline = 'alphabetic'
  ctx.textAlign = 'left'
  ctx.font = 'bold 9px monospace'
  ctx.fillStyle = 'rgba(0,0,0,.45)'
  ctx.fillText(String(s.score).padStart(7, '0'), 7, 13)
  ctx.fillStyle = '#ffffff'
  ctx.fillText(String(s.score).padStart(7, '0'), 6, 12)

  ctx.font = '7px sans-serif'
  ctx.fillStyle = 'rgba(255,255,255,.8)'
  ctx.fillText(s.stage.name, 6, 22)

  // 왼쪽 아래 — 목숨 · 궁극기 · 파워
  const baseY = SKY_H - 8
  ctx.font = '7px monospace'
  ctx.fillStyle = '#ffffff'
  const lives = s.lives === Number.POSITIVE_INFINITY ? '∞' : String(s.lives)
  ctx.fillText(`리온 x${lives}`, 6, baseY - 12)

  for (let i = 0; i < s.player.bombs; i++) {
    ctx.fillStyle = '#ffd166'
    ctx.fillRect(6 + i * 6, baseY - 8, 4, 6)
    ctx.fillStyle = '#c46b00'
    ctx.fillRect(7 + i * 6, baseY - 6, 2, 2)
  }

  for (let i = 0; i < 4; i++) {
    ctx.fillStyle = i <= s.player.power ? '#4bc0ae' : 'rgba(255,255,255,.22)'
    ctx.fillRect(6 + i * 7, baseY - 1, 5, 3)
  }

  // 음소거 — 기존 게임과 같은 자리(MUTE_RECT)에 같은 아이콘
  ctx.font = '9px sans-serif'
  ctx.textAlign = 'right'
  ctx.fillStyle = '#ffffff'
  ctx.fillText(s.muted ? '🔇' : '🔊', SKY_W - 8, 26)
  ctx.textAlign = 'left'

  // 보스 체력
  const b = s.boss
  if (b && b.alive && b.enterMs <= 0) {
    const x0 = 96
    const w = 220
    ctx.fillStyle = 'rgba(0,0,0,.45)'
    ctx.fillRect(x0 - 1, 5, w + 2, 7)
    const r = bossHpRatio(b)
    ctx.fillStyle = r > 0.5 ? '#8fe63c' : r > 0.22 ? '#ffd166' : '#ff5a3c'
    ctx.fillRect(x0, 6, Math.round(w * r), 5)
    ctx.font = '7px sans-serif'
    ctx.textAlign = 'center'
    ctx.fillStyle = '#ffffff'
    ctx.fillText(b.name, x0 + w / 2, 20)
    ctx.textAlign = 'left'
  }
}

// ── 전체 ──────────────────────────────────────────────────────

export function drawSkyWorld(
  ctx: CanvasRenderingContext2D,
  s: SkyState,
  atlas: LoadedAtlas,
  tick: number,
): void {
  ctx.save()
  if (s.shakeMs > 0) {
    const k = s.shakeMs / 420
    ctx.translate(Math.round(wobble(tick) * 3 * k), Math.round(wobble(tick + 5) * 3 * k))
  }

  drawBackground(ctx, s)
  drawItems(ctx, s, atlas, tick)
  drawEnemies(ctx, s, atlas, tick)
  drawBoss(ctx, s, tick)
  drawShots(ctx, s, atlas)
  drawPlayer(ctx, s, atlas, tick)
  for (const beam of s.beams) drawBeam(ctx, beam, tick)
  drawBullets(ctx, s)
  drawBursts(ctx, s)
  drawBombFx(ctx, s, tick)

  ctx.restore()
}
