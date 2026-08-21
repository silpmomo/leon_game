import { describe, expect, it } from 'vitest'
import { updateCamera } from '../src/engine/camera'
import { createPlayer } from '../src/world/player'
import { TILE, VIEW_W } from '../src/engine/tuning'

const LEVEL_W = 200 * TILE

describe('updateCamera', () => {
  it('플레이어를 화면 가로 40% 지점에 둔다', () => {
    const p = createPlayer(100, 9)
    const cam = { x: 0, y: 0 }
    updateCamera(cam, p, LEVEL_W)
    const screenX = p.x + p.w / 2 - cam.x
    expect(screenX).toBeCloseTo(VIEW_W * 0.4, 0)
  })

  it('레벨 왼쪽 끝에서 음수로 가지 않는다', () => {
    const p = createPlayer(0, 9)
    const cam = { x: 0, y: 0 }
    updateCamera(cam, p, LEVEL_W)
    expect(cam.x).toBe(0)
  })

  it('레벨 오른쪽 끝에서 빈 공간을 보여주지 않는다', () => {
    const p = createPlayer(199, 9)
    const cam = { x: 0, y: 0 }
    updateCamera(cam, p, LEVEL_W)
    expect(cam.x).toBe(LEVEL_W - VIEW_W)
  })

  it('왼쪽으로 되돌아가면 카메라도 따라온다 (왼쪽 스크롤 잠금 없음)', () => {
    const cam = { x: 0, y: 0 }
    updateCamera(cam, createPlayer(100, 9), LEVEL_W)
    const xFar = cam.x
    updateCamera(cam, createPlayer(60, 9), LEVEL_W)
    expect(cam.x).toBeLessThan(xFar)
  })

  it('레벨이 화면보다 좁으면 0에 고정된다', () => {
    const p = createPlayer(1, 9)
    const cam = { x: 0, y: 0 }
    updateCamera(cam, p, VIEW_W - 32)
    expect(cam.x).toBe(0)
  })

  it('y는 항상 0이다 (세로 스크롤 없음)', () => {
    const p = createPlayer(100, 9)
    const cam = { x: 0, y: 0 }
    updateCamera(cam, p, LEVEL_W)
    expect(cam.y).toBe(0)
  })

  it('카메라는 항상 레벨 안을 본다', () => {
    const cam = { x: 0, y: 0 }
    for (let tx = 0; tx < 200; tx += 7) {
      updateCamera(cam, createPlayer(tx, 9), LEVEL_W)
      expect(cam.x).toBeGreaterThanOrEqual(0)
      expect(cam.x + VIEW_W).toBeLessThanOrEqual(LEVEL_W)
    }
  })
})
