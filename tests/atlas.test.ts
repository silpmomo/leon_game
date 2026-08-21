import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import atlas from '../src/assets/sprites/atlas.json'
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

describe('아틀라스와 실제 시트가 어긋나지 않는다', () => {
  // 이 검사가 없어서 배포 사고가 났다. 시트는 public/ 의 고정 파일명이라
  // 해시가 없었고, atlas.json 은 해시된 번들에 박혀 있었다. 브라우저가 옛
  // 시트를 캐시에서 꺼내면 좌표표만 새것이 되어 모든 프레임이 엉뚱한 영역을
  // 읽는다. 지금은 시트를 src/ 에서 import 해 번들과 함께 해시되지만,
  // 좌표표와 시트 크기가 맞는지는 여기서 계속 지킨다.
  const png = readFileSync(resolve(__dirname, '../src/assets/sprites/sprites.png'))

  function pngSize(buf: Buffer): { w: number; h: number } {
    expect(buf.subarray(0, 8).toString('binary')).toBe('\x89PNG\r\n\x1a\n')
    return { w: buf.readUInt32BE(16), h: buf.readUInt32BE(20) }
  }

  it('시트가 PNG이고 크기를 읽을 수 있다', () => {
    const { w, h } = pngSize(png)
    expect(w).toBeGreaterThan(0)
    expect(h).toBeGreaterThan(0)
  })

  it('모든 프레임이 시트 안에 들어간다', () => {
    const { w, h } = pngSize(png)
    for (const [name, f] of Object.entries(data.frames)) {
      expect(f.x + f.w, `${name} 이 시트 오른쪽(${w})을 넘는다`).toBeLessThanOrEqual(w)
      expect(f.y + f.h, `${name} 이 시트 아래(${h})를 넘는다`).toBeLessThanOrEqual(h)
    }
  })

  it('시트 폭이 프레임들이 차지하는 폭과 맞는다 (남는 공간이 거의 없다)', () => {
    const { w } = pngSize(png)
    const maxRight = Math.max(...Object.values(data.frames).map((f) => f.x + f.w))
    // 패딩 1px 이므로 정확히 1 차이여야 한다. 어긋나면 좌표표가 다른 시트의 것이다.
    expect(w - maxRight).toBe(1)
  })

  it('시트 높이가 가장 높은 프레임과 맞는다', () => {
    const { h } = pngSize(png)
    const maxBottom = Math.max(...Object.values(data.frames).map((f) => f.y + f.h))
    expect(h - maxBottom).toBe(1)
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
