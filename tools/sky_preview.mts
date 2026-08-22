/**
 * 하늘전투 화면을 브라우저 없이 그려 본다.
 *
 * 실행: npx vite-node tools/sky_preview.mts
 * @napi-rs/canvas 는 --no-save 로만 깔았다. 개발 의존성으로 남기지 않는다.
 */
import { createCanvas, loadImage } from '@napi-rs/canvas'
import { writeFileSync } from 'node:fs'
import atlasJson from '../src/assets/sprites/atlas.json'
import { SKY_STAGES } from '../src/sky/stages'
import { newSkyState, updateSky } from '../src/sky/update'
import { advanceSkyScene } from '../src/sky/scenes'
import { wavesEndMs } from '../src/sky/stages'
import { damageBoss } from '../src/sky/boss'
import { drawSkyHud, drawSkyWorld } from '../src/render/sky'
import { drawSkyControls } from '../src/ui/skyControls'
import { drawSkySelect, drawSkyTitle } from '../src/ui/skyUi'
import { drawGameSelect } from '../src/ui/gameSelect'
import type { SkyInput } from '../src/sky/player'
import type { SkyState } from '../src/sky/types'

const DT = 1 / 60
const W = 416
const H = 192
const Z = 3

const img = await loadImage('src/assets/sprites/sprites.png')
const atlas = { data: atlasJson as never, image: img as never }

function run(s: SkyState, frames: number, input: (i: number) => SkyInput): void {
  for (let i = 0; i < frames; i++) {
    const ev = updateSky(s, input(i), DT)
    advanceSkyScene(s, ev, DT)
  }
}

/** 봇으로 한 판 돌려 보고 몇 번 죽는지 센다 — 난이도 감각용 */
function survey(stageIdx: number, power: number, secs: number): void {
  const s = newSkyState(SKY_STAGES[stageIdx]!, 'practice')
  s.player.power = power
  run(s, 60 * secs, (i) => bot(s, i))
  console.log(
    `  ${s.stage.id} ${s.stage.name}: ${secs}초에 죽음 ${s.deaths}회, 점수 ${s.score}`,
  )
}

/**
 * 8자로 돌면서 가까운 탄을 피하는 가짜 조작.
 *
 * 그냥 8자만 돌면 1탄에서도 계속 죽어 화면에 리온이 안 보인다.
 * 완벽한 회피는 아니지만 "사람이 피할 여지가 있는가" 를 대충 본다.
 */
function bot(s: SkyState, i: number): SkyInput {
  let tx = 90 + Math.sin(i / 40) * 46
  let ty = H / 2 + Math.sin(i / 23) * 52
  const p = s.player
  let px2 = 0
  let py2 = 0
  for (const b of s.bullets) {
    const dx = p.x - b.x
    const dy = p.y - b.y
    const d = Math.hypot(dx, dy)
    if (d > 46 || d < 0.01) continue
    const w = (46 - d) / 46
    px2 += (dx / d) * w * 60
    py2 += (dy / d) * w * 60
  }
  tx += px2
  ty += py2
  return { tx, ty, ax: 0, ay: 0, bomb: false }
}

function shot(name: string, s: SkyState, tick: number, controls = true): void {
  const c = createCanvas(W * Z, H * Z)
  const ctx = c.getContext('2d') as unknown as CanvasRenderingContext2D
  ;(ctx as unknown as { imageSmoothingEnabled: boolean }).imageSmoothingEnabled = false
  ctx.scale(Z, Z)
  drawSkyWorld(ctx, s, atlas, tick)
  drawSkyHud(ctx, s)
  if (controls) drawSkyControls(ctx, s.player.bombs, tick)
  writeFileSync(`tools/.build/${name}.png`, c.toBuffer('image/png'))
  console.log(name, '탄', s.bullets.length, '적', s.enemies.length,
    '보스', s.boss ? `${s.boss.name} p${s.boss.phase}` : '-')
}

function screen(name: string, draw: (ctx: CanvasRenderingContext2D) => void): void {
  const c = createCanvas(W * Z, H * Z)
  const ctx = c.getContext('2d') as unknown as CanvasRenderingContext2D
  ;(ctx as unknown as { imageSmoothingEnabled: boolean }).imageSmoothingEnabled = false
  ctx.scale(Z, Z)
  draw(ctx)
  writeFileSync(`tools/.build/${name}.png`, c.toBuffer('image/png'))
  console.log(name)
}

// ── 1탄 초반 ──────────────────────────────────────────────
{
  const s = newSkyState(SKY_STAGES[0]!, 'practice')
  run(s, 60 * 12, (i) => bot(s, i))
  shot('sky_s1_early', s, 120)
}

// ── 1탄 중반 (파워 최대) ──────────────────────────────────
{
  const s = newSkyState(SKY_STAGES[0]!, 'practice')
  s.player.power = 3
  run(s, 60 * 21, (i) => bot(s, i))
  shot('sky_s1_mid', s, 200)
}

// ── 1탄 보스 ──────────────────────────────────────────────
{
  const s = newSkyState(SKY_STAGES[0]!, 'practice')
  s.player.power = 3
  s.t = wavesEndMs(s.stage)
  s.waveAt = s.stage.waves.length
  run(s, 60 * 6, (i) => bot(s, i))
  shot('sky_s1_boss', s, 300)
}

// ── 5탄 보스 3페이즈 ──────────────────────────────────────
{
  const s = newSkyState(SKY_STAGES[4]!, 'practice')
  s.player.power = 3
  s.t = wavesEndMs(s.stage)
  s.waveAt = s.stage.waves.length
  run(s, 60 * 3, (i) => bot(s, i))
  if (s.boss) {
    s.boss.enterMs = 0
    damageBoss(s.boss, 9999)
    s.boss.morphMs = 0
    damageBoss(s.boss, 9999)
    s.boss.morphMs = 0
  }
  run(s, 60 * 4, (i) => bot(s, i))
  shot('sky_s5_boss3', s, 400)
}

// ── 10탄 최종 보스 마지막 페이즈 ──────────────────────────
{
  const s = newSkyState(SKY_STAGES[9]!, 'practice')
  s.player.power = 3
  s.t = wavesEndMs(s.stage)
  s.waveAt = s.stage.waves.length
  run(s, 60 * 3, (i) => bot(s, i))
  if (s.boss) {
    s.boss.enterMs = 0
    damageBoss(s.boss, 9999)
    s.boss.morphMs = 0
    damageBoss(s.boss, 9999)
    s.boss.morphMs = 0
  }
  run(s, 60 * 5, (i) => bot(s, i))
  shot('sky_s10_final', s, 500)
}

// ── 궁극기 ────────────────────────────────────────────────
{
  const s = newSkyState(SKY_STAGES[6]!, 'practice')
  s.player.power = 3
  s.t = wavesEndMs(s.stage)
  s.waveAt = s.stage.waves.length
  // 죽어 있으면 궁극기가 안 나간다. 이 장면은 연출만 보려는 것이라 무적으로 둔다
  run(s, 60 * 5, (i) => { s.player.invMs = 9999; return bot(s, i) })
  run(s, 1, (i) => ({ ...bot(s, i), bomb: true }))
  run(s, 30, (i) => bot(s, i))
  shot('sky_bomb', s, 600)
}

// ── 유도탄 ────────────────────────────────────────────────
{
  // 로켓이 유도탄을 뿌리는 순간. 너무 늦게 잡으면 이미 다 지나가 버린다
  const s = newSkyState(SKY_STAGES[3]!, 'practice')
  s.player.power = 1
  run(s, 60 * 3, (i) => bot(s, i))
  shot('sky_homing', s, 180)
}

// ── 보스 격파 시간 ────────────────────────────────────────
/** 완벽하게 조준하는 플레이어가 보스를 몇 초에 잡는가 (무적으로 둬 회피는 뺀다) */
function bossTtk(stageIdx: number, power: number): void {
  const s = newSkyState(SKY_STAGES[stageIdx]!, 'practice')
  s.player.power = power
  s.t = wavesEndMs(s.stage)
  s.waveAt = s.stage.waves.length
  let secs = 0
  for (let i = 0; i < 60 * 150; i++) {
    s.player.invMs = 999 // 조준만 보고 싶다
    const b = s.boss
    const ev = updateSky(s, {
      tx: 80, ty: b ? b.y : H / 2, ax: 0, ay: 0, bomb: false,
    }, DT)
    advanceSkyScene(s, ev, DT)
    if (s.scene === 'clear') { secs = i / 60; break }
  }
  const total = SKY_STAGES[stageIdx]!.boss.phases.reduce((a, p) => a + p.hp, 0)
  console.log(
    `  ${SKY_STAGES[stageIdx]!.boss.name.padEnd(7)} 체력 ${String(total).padStart(5)}`
    + ` → ${secs ? secs.toFixed(1) : '150+'}초 (파워 ${power + 1})`,
  )
}

console.log('보스 격파 시간 (완벽 조준·무적):')
for (let i = 0; i < 10; i++) bossTtk(i, 3)

// ── 난이도 훑기 ───────────────────────────────────────────
console.log('봇 생존 조사 (완벽한 회피는 아니다):')
for (const i of [0, 2, 4, 6, 9]) survey(i, 1, 45)

// ── 메뉴 ──────────────────────────────────────────────────
screen('sky_title', (ctx) => {
  drawSkyTitle(ctx, atlas, { practice: {}, challenge: {} }, 30)
})
screen('sky_select', (ctx) => {
  drawSkySelect(ctx, {
    'sky-01': { cleared: true, bestScore: 48200, bestTimeMs: 90_000, fewestDeaths: 0 },
    'sky-02': { cleared: true, bestScore: 51000, bestTimeMs: 92_000, fewestDeaths: 1 },
  }, '연습', 30)
})
screen('sky_hub', (ctx) => {
  drawGameSelect(ctx, atlas, {
    adventure: { 'stage-01': { cleared: true, bestScore: 1, bestTimeMs: 1, fewestDeaths: 0 } },
    sky: {},
  }, { adventure: 20, sky: 10 })
})
