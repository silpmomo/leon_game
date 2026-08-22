/**
 * 스테이지를 브라우저 없이 그려 본다.
 *
 * 실행: npm install --no-save @napi-rs/canvas
 *      npx vite-node tools/level_preview.mts [스테이지번호...]
 *
 * 카메라를 스테이지 폭만큼 옮겨 가며 이어 붙여 한 장으로 만든다.
 * 움직이는 발판은 왕복 범위를 점선으로 같이 표시한다.
 */
import { createCanvas, loadImage } from '@napi-rs/canvas'
import { writeFileSync } from 'node:fs'
import atlasJson from '../src/assets/sprites/atlas.json'
import { STAGES } from '../src/levels/index'
import { newGameState } from '../src/game/update'
import { drawWorld } from '../src/render/renderer'
import { TILE, VIEW_H, VIEW_W } from '../src/engine/tuning'
import type { LevelData } from '../src/types'

const img = await loadImage('src/assets/sprites/sprites.png')
const atlas = { data: atlasJson as never, image: img as never }

const args = process.argv.slice(2).map(Number).filter((n) => !Number.isNaN(n))
const want = args.length ? args : [21, 22, 25, 30]

for (const num of want) {
  const level = STAGES[num - 1] as LevelData | undefined
  if (!level) continue

  const wpx = level.width * TILE
  const shots = Math.ceil(wpx / VIEW_W)
  const c = createCanvas(wpx, VIEW_H)
  const ctx = c.getContext('2d') as unknown as CanvasRenderingContext2D
  ;(ctx as unknown as { imageSmoothingEnabled: boolean }).imageSmoothingEnabled = false

  const s = newGameState(level, 'practice')
  for (let i = 0; i < shots; i++) {
    const camX = Math.min(i * VIEW_W, wpx - VIEW_W)
    s.camera.x = camX
    s.player.x = camX + 40
    s.player.y = level.spawn.y * TILE - 8
    ctx.save()
    ctx.beginPath()
    ctx.rect(camX, 0, VIEW_W, VIEW_H)
    ctx.clip()
    ctx.translate(camX, 0)
    drawWorld(ctx, s, atlas, 12)
    ctx.restore()
  }

  // 움직이는 발판의 왕복 범위
  ctx.strokeStyle = 'rgba(255,80,80,.8)'
  ctx.setLineDash([3, 3])
  ctx.lineWidth = 1
  for (const e of level.entities) {
    if (e.type !== 'platform' || e.speed === 0) continue
    const x = e.x * TILE
    const y = e.y * TILE
    if (e.axis === 'x') {
      ctx.strokeRect(x - e.range * TILE, y, (e.range * 2 + 3) * TILE, 8)
    } else {
      ctx.strokeRect(x, y - e.range * TILE, 3 * TILE, (e.range * 2) * TILE + 8)
    }
  }

  const out = `tools/.build/level-${level.id}.png`
  writeFileSync(out, c.toBuffer('image/png'))
  console.log(`${level.name} ${level.theme} ${wpx}x${VIEW_H} → ${out}`)
}
