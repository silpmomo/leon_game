import { VIEW_H, VIEW_W } from './engine/tuning'

const canvas = document.getElementById('game') as HTMLCanvasElement
const ctx = canvas.getContext('2d')!

function resize(): void {
  const scale = Math.max(
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

window.addEventListener('resize', resize)
resize()

ctx.fillStyle = '#8ed0f2'
ctx.fillRect(0, 0, VIEW_W, VIEW_H)
ctx.fillStyle = '#0b0d12'
ctx.font = '8px monospace'
ctx.fillText('leon_game', 8, 16)
