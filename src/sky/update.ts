import type {
  Burst, EBullet, Shot, SkyEnemy, SkyEvent, SkyItem, SkyMode, SkyStage, SkyState,
} from './types'
import {
  BOMB, BOSS_RUSH_MS, COIN, CULL, LIVES_CHALLENGE, PLAYER, PLAYER_R,
  SCORE, SCROLL_SPEED, SKY_H, SKY_W,
} from './tuning'
import { beamHits, bulletX, bulletY, stepBeams, stepBullets } from './bullets'
import { enemyFire, enemyGone, spawnEnemy, stepEnemy } from './enemies'
import { bossFinished, damageBoss, spawnBoss, stepBoss } from './boss'
import {
  addBomb, autoFire, bump, moveOptions, movePlayer, newPlayer, powerUp,
  syncOptions, useBomb, type SkyInput,
} from './player'
import { wavesEndMs } from './stages'
import { makeRng } from './rng'

/** 점수 이만큼마다 목숨 하나 (도전 모드) */
const EXTRA_EVERY = 150_000

export function newSkyState(stage: SkyStage, mode: SkyMode): SkyState {
  const p = newPlayer()
  return {
    scene: 'playing',
    mode,
    stage,
    player: p,
    shots: [],
    options: syncOptions(p, []),
    bullets: [],
    beams: [],
    enemies: [],
    items: [],
    bursts: [],
    boss: null,
    t: 0,
    waveAt: 0,
    pending: [],
    score: 0,
    lives: mode === 'practice' ? Number.POSITIVE_INFINITY : LIVES_CHALLENGE,
    deaths: 0,
    scroll: 0,
    sceneMs: 0,
    flashMs: 0,
    bombMs: 0,
    nextExtra: EXTRA_EVERY,
    shakeMs: 0,
    seed: 20260822,
    muted: false,
    bossOut: false,
  }
}

function boom(list: Burst[], x: number, y: number, r: number, hue: Burst['hue']): void {
  list.push({ x, y, age: 0, life: r > 16 ? 620 : 320, r, hue })
}

/** 점(원) 이 사각형에 닿았는가 */
function hitsBox(
  px: number, py: number, r: number,
  bx: number, by: number, bw: number, bh: number,
): boolean {
  const hx = bw / 2
  const hy = bh / 2
  const dx = Math.abs(px - bx) - hx
  const dy = Math.abs(py - by) - hy
  if (dx <= 0 && dy <= 0) return true
  const ox = Math.max(dx, 0)
  const oy = Math.max(dy, 0)
  return ox * ox + oy * oy <= r * r
}

/** 코인은 늦게 먹을수록 값이 떨어진다 (텐가이와 같은 규칙) */
export function coinValue(ageMs: number): number {
  const k = Math.max(0, 1 - ageMs / COIN.decayMs)
  return Math.round(COIN.min + (COIN.max - COIN.min) * k)
}

function nearestEnemy(s: SkyState, x: number, y: number): { x: number; y: number } | null {
  let best: { x: number; y: number } | null = null
  let bd = Infinity
  for (const e of s.enemies) {
    if (!e.alive || e.x > SKY_W) continue
    const d = (e.x - x) ** 2 + (e.y - y) ** 2
    if (d < bd) {
      bd = d
      best = e
    }
  }
  if (s.boss && s.boss.alive && s.boss.enterMs <= 0) {
    const b = s.boss
    const d = (b.x - x) ** 2 + (b.y - y) ** 2
    if (d < bd) best = b
  }
  return best
}

/** 편대 예약을 풀어 적을 내보낸다 */
function runSpawns(s: SkyState, dt: number): void {
  const ms = dt * 1000
  const stage = s.stage

  while (s.waveAt < stage.waves.length && stage.waves[s.waveAt]!.atMs <= s.t) {
    const spec = stage.waves[s.waveAt]!
    for (let i = 0; i < spec.count; i++) {
      s.pending.push({ left: spec.gapMs * i, spec, idx: i })
    }
    s.waveAt += 1
  }

  const keep: typeof s.pending = []
  for (const q of s.pending) {
    q.left -= ms
    if (q.left > 0) {
      keep.push(q)
      continue
    }
    const e = spawnEnemy(q.spec, q.idx)
    // 아이템은 편대의 마지막 한 마리가 떨군다. 편대를 끝까지 잡게 만든다
    e.drop = q.idx === q.spec.count - 1 ? (q.spec.drop ?? null) : null
    s.enemies.push(e)
  }
  s.pending = keep
}

function dropItem(s: SkyState, e: SkyEnemy): void {
  if (!e.drop) return
  s.items.push({ kind: e.drop, x: e.x, y: e.y, vx: -34, vy: -18, age: 0 })
}

function killEnemy(s: SkyState, e: SkyEnemy, ev: SkyEvent[]): void {
  e.alive = false
  s.score += e.score
  boom(s.bursts, e.x, e.y, e.w > 20 ? 20 : 12, 'amber')
  dropItem(s, e)
  ev.push('kill')
}

/** 궁극기 — 화면의 탄을 지우고 모두에게 피해를 준다 */
function detonate(s: SkyState, ev: SkyEvent[]): void {
  s.bullets = []
  s.beams = []
  s.bombMs = BOMB.ms
  s.flashMs = BOMB.flashMs
  s.shakeMs = BOMB.shakeMs
  for (const e of s.enemies) {
    if (!e.alive) continue
    e.hp -= BOMB.dmg
    e.hitMs = 120
    if (e.hp <= 0) killEnemy(s, e, ev)
  }
  if (s.boss) {
    const r = damageBoss(s.boss, BOMB.dmg)
    if (r === 'dead') ev.push('bossDown')
    else if (r !== 'none') ev.push('bossHit')
  }
  boom(s.bursts, s.player.x, s.player.y, 44, 'white')
  ev.push('bomb')
}

function collectItem(s: SkyState, it: SkyItem, ev: SkyEvent[]): void {
  switch (it.kind) {
    case 'power':
      if (powerUp(s.player)) ev.push('power')
      else s.score += 1000
      s.options = syncOptions(s.player, s.options)
      break
    case 'bomb':
      // 텐가이 규칙 — 꽉 찼을 때 먹으면 큰 점수로 바뀐다
      if (addBomb(s.player)) ev.push('power')
      else {
        s.score += SCORE.bombFull
        ev.push('coin')
      }
      break
    case 'coin':
      s.score += coinValue(it.age)
      ev.push('coin')
      break
  }
}

function playerDies(s: SkyState, ev: SkyEvent[]): void {
  if (s.player.invMs > 0 || !s.player.alive) return
  s.player.alive = false
  s.deaths += 1
  if (s.mode === 'challenge') s.lives -= 1
  boom(s.bursts, s.player.x, s.player.y, 26, 'white')
  s.shakeMs = 320
  ev.push('die')
}

/** 죽은 뒤 다시 세운다. 파워는 초기화되지만 궁극기는 채워 준다 */
export function respawnSky(s: SkyState): void {
  const p = s.player
  p.x = 70
  p.y = SKY_H / 2
  p.power = 0
  p.bombs = Math.max(p.bombs, PLAYER.startBombs)
  p.invMs = PLAYER.respawnInvMs
  p.stunMs = 0
  p.cool = 0
  p.alive = true
  s.options = syncOptions(p, [])
  s.bullets = []
  s.beams = []
}

export function updateSky(s: SkyState, input: SkyInput, dt: number): SkyEvent[] {
  const ev: SkyEvent[] = []
  if (s.scene !== 'playing') return ev

  const ms = dt * 1000
  s.t += ms
  s.scroll += SCROLL_SPEED * dt
  if (s.flashMs > 0) s.flashMs = Math.max(0, s.flashMs - ms)
  if (s.bombMs > 0) s.bombMs = Math.max(0, s.bombMs - ms)
  if (s.shakeMs > 0) s.shakeMs = Math.max(0, s.shakeMs - ms)

  const rng = makeRng(s.seed)
  const p = s.player

  // ── 궁극기 ──────────────────────────────────────────────
  if (input.bomb && p.alive && useBomb(p)) detonate(s, ev)

  // ── 플레이어 ────────────────────────────────────────────
  if (p.alive) {
    movePlayer(p, input, dt)
    s.options = syncOptions(p, s.options)
    moveOptions(p, s.options, dt)
    if (autoFire(p, s.options, s.shots, dt)) ev.push('shot')
  }

  // ── 편대 ────────────────────────────────────────────────
  runSpawns(s, dt)

  // ── 보스 등장 ───────────────────────────────────────────
  if (!s.bossOut && s.waveAt >= s.stage.waves.length
      && s.pending.length === 0 && s.t >= wavesEndMs(s.stage)) {
    s.boss = spawnBoss(s.stage.boss)
    s.bossOut = true
    ev.push('bossIn')
  }

  // ── 적 이동·발사 ────────────────────────────────────────
  for (const e of s.enemies) {
    if (!e.alive) continue
    stepEnemy(e, dt)
    if (p.alive) enemyFire(e, p.x, p.y, s.bullets, s.beams, dt, rng)
  }
  s.enemies = s.enemies.filter((e) => e.alive && !enemyGone(e))

  // ── 보스 ────────────────────────────────────────────────
  if (s.boss) {
    const b = s.boss
    // 오래 끌면 탄이 조금 빨라진다. 무한정 버티기를 막는다
    const rush = b.t > BOSS_RUSH_MS ? 1.15 : 1
    stepBoss(b, p.x, p.y, s.bullets, s.beams, dt, rng, rush)
    if (bossFinished(b)) {
      b.alive = false
      s.score += SCORE.stageClear
      s.scene = 'clear'
      ev.push('clear')
    }
  }

  s.seed = rng.seed

  // ── 아군 탄 ─────────────────────────────────────────────
  const shots: Shot[] = []
  for (const sh of s.shots) {
    sh.age += ms
    if (sh.homing) {
      const target = nearestEnemy(s, sh.x, sh.y)
      if (target) {
        const want = Math.atan2(target.y - sh.y, target.x - sh.x)
        const cur = Math.atan2(sh.vy, sh.vx)
        let d = want - cur
        while (d > Math.PI) d -= Math.PI * 2
        while (d < -Math.PI) d += Math.PI * 2
        const max = 4.2 * dt
        const a = cur + Math.max(-max, Math.min(max, d))
        const sp = Math.hypot(sh.vx, sh.vy)
        sh.vx = Math.cos(a) * sp
        sh.vy = Math.sin(a) * sp
      }
    }
    sh.x += sh.vx * dt
    sh.y += sh.vy * dt
    // 화면 오른쪽 끝에서 멈춘다. 밖에서 죽이면 적이 등장하기도 전에 사라진다
    if (sh.x > SKY_W || sh.x < -CULL) continue
    if (sh.y > SKY_H + CULL || sh.y < -CULL) continue
    if (sh.age > 3000) continue
    shots.push(sh)
  }
  s.shots = shots

  // ── 아군 탄 ↔ 적 ────────────────────────────────────────
  for (const sh of s.shots) {
    let spent = false
    for (const e of s.enemies) {
      if (!e.alive) continue
      if (!hitsBox(sh.x, sh.y, sh.r, e.x, e.y, e.w, e.h)) continue
      e.hp -= sh.dmg
      e.hitMs = 70
      if (e.hp <= 0) killEnemy(s, e, ev)
      else ev.push('hit')
      spent = true
      break
    }
    if (spent) {
      sh.age = 9999
      continue
    }
    const b = s.boss
    if (b && b.alive && b.enterMs <= 0
        && hitsBox(sh.x, sh.y, sh.r, b.x, b.y, b.w * 0.72, b.h * 0.78)) {
      const r = damageBoss(b, sh.dmg)
      if (r === 'dead') {
        boom(s.bursts, b.x, b.y, 40, 'white')
        ev.push('bossDown')
      } else if (r === 'phase') {
        boom(s.bursts, b.x, b.y, 30, 'amber')
        ev.push('bossDown')
      } else if (r === 'hit') {
        ev.push('bossHit')
      }
      sh.age = 9999
    }
  }
  s.shots = s.shots.filter((sh) => sh.age < 9999)

  // ── 적탄 ────────────────────────────────────────────────
  s.bullets = stepBullets(s.bullets, p.x, p.y, dt)
  s.beams = stepBeams(s.beams, dt)
  // 궁극기가 도는 동안에는 새로 나온 탄도 계속 지워진다
  if (s.bombMs > 0) {
    s.bullets = []
    s.beams = []
  }

  // ── 피탄 ────────────────────────────────────────────────
  if (p.alive && p.invMs <= 0) {
    for (const b of s.bullets) {
      const bx = bulletX(b)
      const by = bulletY(b)
      if ((bx - p.x) ** 2 + (by - p.y) ** 2 <= (PLAYER_R + b.r) ** 2) {
        playerDies(s, ev)
        break
      }
    }
  }
  if (p.alive && p.invMs <= 0) {
    for (const beam of s.beams) {
      if (beamHits(beam, p.x, p.y, PLAYER_R)) {
        playerDies(s, ev)
        break
      }
    }
  }

  // ── 적과 부딪힘 — 죽지 않고 파워만 잃는다 (텐가이 규칙) ──
  if (p.alive && p.invMs <= 0 && p.stunMs <= 0) {
    for (const e of s.enemies) {
      if (!e.alive) continue
      if (!hitsBox(p.x, p.y, PLAYER_R + 3, e.x, e.y, e.w, e.h)) continue
      bump(p)
      s.options = syncOptions(p, s.options)
      boom(s.bursts, p.x, p.y, 12, 'white')
      ev.push('hit')
      break
    }
  }

  // ── 아이템 ──────────────────────────────────────────────
  const items: SkyItem[] = []
  for (const it of s.items) {
    it.age += ms
    it.vy += 42 * dt
    if (it.vy > 26) it.vy = 26
    it.x += it.vx * dt
    it.y += it.vy * dt
    if (it.y > SKY_H - 10) {
      it.y = SKY_H - 10
      it.vy = -it.vy * 0.45
    }
    if (it.x < -CULL) continue
    if (p.alive && (it.x - p.x) ** 2 + (it.y - p.y) ** 2 <= 12 ** 2) {
      collectItem(s, it, ev)
      continue
    }
    items.push(it)
  }
  s.items = items

  // ── 연출 ────────────────────────────────────────────────
  const bursts: Burst[] = []
  for (const b of s.bursts) {
    b.age += ms
    if (b.age < b.life) bursts.push(b)
  }
  s.bursts = bursts

  // ── 목숨 추가 ───────────────────────────────────────────
  if (s.mode === 'challenge' && s.score >= s.nextExtra) {
    s.lives += 1
    s.nextExtra += EXTRA_EVERY
    ev.push('extra')
  }

  return ev
}

/** 화면 밖으로 나간 탄까지 세는 진단용 */
export function liveBullets(s: SkyState): EBullet[] {
  return s.bullets
}
