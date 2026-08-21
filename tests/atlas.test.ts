import { describe, expect, it } from 'vitest'
import atlas from '../public/sprites/atlas.json'
import { FALLBACK_COLOR, REQUIRED_FRAMES, frame } from '../src/render/atlas'
import type { AtlasData } from '../src/render/atlas'

const data = atlas as AtlasData

describe('atlas.json', () => {
  it('시트 파일명을 담고 있다', () => {
    expect(data.sheet).toBe('sprites.png')
  })

  it('필요한 프레임이 모두 있다', () => {
    const missing = REQUIRED_FRAMES.filter((n) => !(n in data.frames))
    expect(missing).toEqual([])
  })

  it('모든 프레임이 양수 크기다', () => {
    for (const [name, f] of Object.entries(data.frames)) {
      expect(f.w, name).toBeGreaterThan(0)
      expect(f.h, name).toBeGreaterThan(0)
      expect(f.x, name).toBeGreaterThanOrEqual(0)
      expect(f.y, name).toBeGreaterThanOrEqual(0)
    }
  })

  it('프레임이 서로 겹치지 않는다', () => {
    const list = Object.entries(data.frames)
    for (let i = 0; i < list.length; i++) {
      for (let j = i + 1; j < list.length; j++) {
        const [na, a] = list[i]!
        const [nb, b] = list[j]!
        const overlap =
          a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h
        expect(overlap, `${na} 와 ${nb} 가 겹친다`).toBe(false)
      }
    }
  })

  it('타일 프레임은 16x16이다', () => {
    for (const n of ['ground', 'brick', 'question', 'used', 'hard', 'pipeTop', 'pipeBody']) {
      expect(data.frames[n], n).toMatchObject({ w: 16, h: 16 })
    }
  })

  it('적 프레임 크기가 히트박스 크기와 맞는다', () => {
    expect(data.frames.broccoli0).toMatchObject({ w: 12, h: 12 })
    expect(data.frames.soupCrouch).toMatchObject({ w: 14, h: 12 })
    expect(data.frames.crocodile0).toMatchObject({ w: 26, h: 10 })
  })

  it('얼굴은 32px 폭이다', () => {
    expect(data.frames.face!.w).toBe(32)
    expect(data.frames.face!.h).toBeGreaterThan(30)
  })
})

describe('frame', () => {
  it('이름으로 사각형을 찾는다', () => {
    expect(frame(data, 'face')).toEqual(data.frames.face)
  })

  it('없는 이름은 null을 준다 (예외를 던지지 않는다)', () => {
    expect(frame(data, '없는프레임')).toBeNull()
  })
})

describe('FALLBACK_COLOR', () => {
  it('스프라이트 로드 실패 시 쓸 색이 모든 필수 프레임에 있다', () => {
    for (const n of REQUIRED_FRAMES) {
      expect(FALLBACK_COLOR[n], `${n} 폴백 색 없음`).toMatch(/^#[0-9a-f]{6}$/i)
    }
  })
})
