import level from './levels/1-1.json'
import type { GameState, LevelData } from './types'
import { TILE, VIEW_H, VIEW_W } from './engine/tuning'
import { updateCamera } from './engine/camera'
import { parseTiles } from './world/tilemap'
import { createPlayer, updatePlayer } from './world/player'
import { createInput } from './core/input'
import { createLoop } from './core/loop'
import { drawControls, drawWorld } from './render/renderer'
import { drawRotateOverlay, isPortrait } from './ui/orientation'

const canvas = document.getElementById('game') as HTMLCanvasElement
const ctx = canvas.getContext('2d')!
ctx.imageSmoothingEnabled = false

const data = level as LevelData
const { grid, coins } = parseTiles(data.tiles)

const state: GameState = {
  scene: 'playing',
  mode: 'practice',
  level: data,
  grid,
  player: createPlayer(data.spawn.x, data.spawn.y),
  enemies: [],
  coins,
  items: [],
  balls: [],
  platforms: [],
  bumps: [],
  camera: { x: 0, y: 0 },
  coinCount: 0,
  score: 0,
  lives: 3,
  timeMs: 0,
  deaths: 0,
  combo: 0,
  checkpointX: data.spawn.x,
  sceneMs: 0,
  muted: false,
}

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
    updatePlayer(state.player, input.state, state.grid, dt)
    updateCamera(state.camera, state.player, state.level.width * TILE)
    // 임시: 낙하 시 리스폰 (Task 13에서 씬 상태머신으로 대체)
    if (state.player.y > state.level.height * TILE + 32) {
      state.player = createPlayer(state.level.spawn.x, state.level.spawn.y)
    }
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
