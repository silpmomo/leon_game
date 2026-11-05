/**
 * 숲속대결 화면을 브라우저 없이 그려 본다 → tools/.build/arena_*.png
 *   npm install --no-save @napi-rs/canvas
 *   npx vite-node tools/arena_preview.mts
 */
import { createCanvas, loadImage } from '@napi-rs/canvas'
import { mkdirSync, writeFileSync } from 'node:fs'
import atlasJson from '../src/assets/sprites/atlas.json'
import { ARENA_MAPS } from '../src/arena/maps'
import { newArenaState, updateArena } from '../src/arena/update'
import { advanceArenaScene } from '../src/arena/scenes'
import { NO_INPUT, type ArenaState } from '../src/arena/types'
import { drawArenaHud, drawArenaWorld } from '../src/render/arena'
import {
  drawArenaControls, drawArenaResult, drawArenaSelect, drawArenaTitle,
} from '../src/ui/arenaUi'
import { drawGameSelect } from '../src/ui/gameSelect'

const DT = 1 / 60
const W = 416
const H = 192
const Z = 3
mkdirSync('tools/.build', { recursive: true })
const img = await loadImage('src/assets/sprites/sprites.png')
const atlas = { data: atlasJson as never, image: img as never }

function shot(name: string, draw: (ctx: CanvasRenderingContext2D) => void): void {
  const c = createCanvas(W * Z, H * Z)
  const ctx = c.getContext('2d') as unknown as CanvasRenderingContext2D
  ctx.imageSmoothingEnabled = false
  ctx.scale(Z, Z)
  draw(ctx)
  writeFileSync(`tools/.build/arena_${name}.png`, c.toBuffer('image/png'))
}

function run(s: ArenaState, secs: number): void {
  for (let i = 0; i < secs * 60; i++) {
    const ev = updateArena(s, NO_INPUT, DT, { autopilot: true })
    advanceArenaScene(s, ev, DT)
    if (s.scene === 'clear' || s.scene === 'gameover' || s.scene === 'dead') break
  }
}

shot('hub', (ctx) => drawGameSelect(ctx, atlas, {}, { adventure: 30, sky: 10, arena: 6 }))
shot('title', (ctx) => drawArenaTitle(ctx, atlas, { practice: {}, challenge: {} }, 0))
shot('select', (ctx) => drawArenaSelect(ctx, { a1: { cleared: true, bestScore: 1640, bestTimeMs: 1, fewestDeaths: 0 } }, '연습', 1, 0))

for (const [i, secs] of [[0, 1], [1, 12], [4, 40], [5, 55]] as const) {
  const s = newArenaState(ARENA_MAPS[i]!, 'practice', 4242 + i)
  s.scene = 'playing'
  run(s, secs)
  shot(`play${i + 1}`, (ctx) => {
    drawArenaWorld(ctx, s, atlas, 30)
    const p = s.fighters[0]!
    drawArenaControls(ctx, { ox: 60, oy: 140, kx: 72, ky: 134 }, p.ammo, p.superCharge, true, 0)
    drawArenaHud(ctx, s, 30)
  })
}
const s = newArenaState(ARENA_MAPS[0]!, 'practice', 99)
run(s, 200)
shot('result', (ctx) => {
  drawArenaWorld(ctx, s, atlas, 0)
  drawArenaResult(ctx, s, true)
})
console.log('끝 — tools/.build/arena_*.png', s.scene)
