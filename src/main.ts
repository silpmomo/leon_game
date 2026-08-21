import level from './levels/1-1.json'
import type { LevelData } from './types'
import { VIEW_H, VIEW_W } from './engine/tuning'
import { newGameState, updateFrame } from './game/update'
import { createInput } from './core/input'
import { createLoop } from './core/loop'
import { drawControls, drawWorld } from './render/renderer'
import { drawRotateOverlay, isPortrait } from './ui/orientation'

const canvas = document.getElementById('game') as HTMLCanvasElement
const ctx = canvas.getContext('2d')!
ctx.imageSmoothingEnabled = false

const data = level as LevelData
let state = newGameState(data, 'practice')

const input = createInput()
let scale = 1

function resize(): void {
  scale = Math.max(
    1,
    Math.min(
      Math.floor(window.innerWidth / VIEW_W),
      Math.floor(window.innerHeight / VIEW_H),
    ),
  )
  canvas.width = VIEW_W
  canvas.height = VIEW_H
  canvas.style.width = `${VIEW_W * scale}px`
  canvas.style.height = `${VIEW_H * scale}px`
  ctx.imageSmoothingEnabled = false
}

/** 화면 좌표 → 논리 좌표 */
function toLogical(clientX: number, clientY: number): [number, number] {
  const r = canvas.getBoundingClientRect()
  return [(clientX - r.left) / scale, (clientY - r.top) / scale]
}

canvas.addEventListener('pointerdown', (e) => {
  e.preventDefault()
  canvas.setPointerCapture(e.pointerId)
  input.onPointerDown(e.pointerId, ...toLogical(e.clientX, e.clientY), state.player.power)
})
canvas.addEventListener('pointermove', (e) => {
  input.onPointerMove(e.pointerId, ...toLogical(e.clientX, e.clientY), state.player.power)
})
for (const type of ['pointerup', 'pointercancel', 'lostpointercapture'] as const) {
  canvas.addEventListener(type, (e) => {
    input.onPointerUp(e.pointerId)
  })
}
window.addEventListener('keydown', (e) => {
  input.onKey(e.code, true)
})
window.addEventListener('keyup', (e) => {
  input.onKey(e.code, false)
})
window.addEventListener('blur', () => {
  input.reset()
})
window.addEventListener('resize', resize)

const loop = createLoop({
  update: (dt) => {
    if (isPortrait()) return
    input.beginFrame()
    const events = updateFrame(state, input.state, dt)
    // 임시: Task 13에서 씬 상태머신으로 대체된다
    if (events.includes('die')) state = newGameState(state.level, state.mode)
    input.endFrame()
  },
  render: () => {
    if (isPortrait()) {
      drawRotateOverlay(ctx)
      return
    }
    drawWorld(ctx, state)
    drawControls(ctx, state.player.power)
  },
})

resize()
loop.start()
