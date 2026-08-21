import { describe, expect, it } from 'vitest'
import { BUTTON_ALPHA, buttonRects, hitTest } from '../src/ui/controls'
import { createInput } from '../src/core/input'
import { VIEW_H, VIEW_W } from '../src/engine/tuning'
import type { Rect } from '../src/types'

const center = (r: Rect) => [r.x + r.w / 2, r.y + r.h / 2] as const

describe('buttonRects', () => {
  it('작은 상태에서는 버튼이 3개다', () => {
    const r = buttonRects('small')
    expect(r.left).not.toBeNull()
    expect(r.right).not.toBeNull()
    expect(r.jump).not.toBeNull()
    expect(r.fire).toBeNull()
  })

  it('big 상태에서도 발사 버튼은 없다', () => {
    expect(buttonRects('big').fire).toBeNull()
  })

  it('ball 상태에서만 발사 버튼이 나타난다', () => {
    expect(buttonRects('ball').fire).not.toBeNull()
  })

  it('이동 버튼은 좌하단, 점프는 우하단 코너에 있다', () => {
    const r = buttonRects('small')
    expect(r.left!.x).toBeLessThan(VIEW_W / 4)
    expect(r.right!.x).toBeLessThan(VIEW_W / 2)
    expect(r.jump!.x).toBeGreaterThan(VIEW_W / 2)
    for (const b of [r.left!, r.right!, r.jump!]) {
      expect(b.y + b.h).toBeLessThanOrEqual(VIEW_H)
      expect(b.y).toBeGreaterThan(VIEW_H / 2)
    }
  })

  it('점프 버튼이 이동 버튼보다 크다', () => {
    const r = buttonRects('small')
    expect(r.jump!.w).toBeGreaterThan(r.left!.w)
  })

  it('이동 버튼끼리 겹치지 않는다', () => {
    const r = buttonRects('small')
    expect(r.left!.x + r.left!.w).toBeLessThanOrEqual(r.right!.x)
  })

  it('발사 버튼은 점프 버튼 왼쪽에 있고 겹치지 않는다', () => {
    const r = buttonRects('ball')
    expect(r.fire!.x + r.fire!.w).toBeLessThanOrEqual(r.jump!.x)
  })

  it('발사 버튼이 나타나도 이동 버튼과 겹치지 않는다', () => {
    const r = buttonRects('ball')
    expect(r.right!.x + r.right!.w).toBeLessThan(r.fire!.x)
  })

  it('발사 버튼이 생겨도 다른 버튼 위치는 그대로다', () => {
    const a = buttonRects('small')
    const b = buttonRects('ball')
    expect(b.left).toEqual(a.left)
    expect(b.right).toEqual(a.right)
    expect(b.jump).toEqual(a.jump)
  })

  it('불투명도는 42%', () => {
    expect(BUTTON_ALPHA).toBeCloseTo(0.42, 5)
  })
})

describe('hitTest', () => {
  it('버튼 중앙을 누르면 그 버튼이 잡힌다', () => {
    const r = buttonRects('small')
    expect(hitTest(...center(r.left!), 'small')).toBe('left')
    expect(hitTest(...center(r.right!), 'small')).toBe('right')
    expect(hitTest(...center(r.jump!), 'small')).toBe('jump')
  })

  it('보이는 원 바로 밖 8%도 잡힌다 (히트박스 +20%)', () => {
    const r = buttonRects('small')
    const [cx, cy] = center(r.jump!)
    const justOutside = cx + r.jump!.w / 2 + r.jump!.w * 0.08
    expect(hitTest(justOutside, cy, 'small')).toBe('jump')
  })

  it('보이는 원 크기 그대로면 잡히지 않을 지점도 히트박스 확대로 잡힌다', () => {
    const r = buttonRects('small')
    const [cx, cy] = center(r.jump!)
    const onVisibleEdge = cx + r.jump!.w / 2 + 1
    expect(hitTest(onVisibleEdge, cy, 'small')).toBe('jump')
  })

  it('한참 밖은 잡히지 않는다', () => {
    expect(hitTest(VIEW_W / 2, 10, 'small')).toBeNull()
  })

  it('작은 상태에서 발사 버튼 자리를 눌러도 아무것도 잡히지 않는다', () => {
    const r = buttonRects('ball')
    expect(hitTest(...center(r.fire!), 'small')).toBeNull()
  })

  it('ball 상태에서는 발사 버튼 자리가 잡힌다', () => {
    const r = buttonRects('ball')
    expect(hitTest(...center(r.fire!), 'ball')).toBe('fire')
  })
})

describe('createInput — 키보드', () => {
  it('화살표와 스페이스를 매핑한다', () => {
    const i = createInput()
    i.beginFrame()
    i.onKey('ArrowRight', true)
    i.onKey('Space', true)
    expect(i.state.right).toBe(true)
    expect(i.state.jump).toBe(true)
    expect(i.state.jumpPressed).toBe(true)
    i.endFrame()
    i.beginFrame()
    expect(i.state.jump).toBe(true)
    expect(i.state.jumpPressed).toBe(false) // 유지 중이지만 엣지는 아니다
  })

  it('키를 떼면 꺼진다', () => {
    const i = createInput()
    i.onKey('ArrowLeft', true)
    expect(i.state.left).toBe(true)
    i.onKey('ArrowLeft', false)
    expect(i.state.left).toBe(false)
  })

  it('키 반복(autorepeat)이 jumpPressed를 다시 켜지 않는다', () => {
    const i = createInput()
    i.onKey('Space', true)
    i.endFrame()
    i.onKey('Space', true) // 반복
    expect(i.state.jumpPressed).toBe(false)
  })

  it('모르는 키는 무시한다', () => {
    const i = createInput()
    i.onKey('KeyZ', true)
    expect(i.state).toMatchObject({ left: false, right: false, jump: false })
  })
})

describe('createInput — 터치', () => {
  it('버튼을 누르면 해당 입력이 켜진다', () => {
    const i = createInput()
    const r = buttonRects('small')
    i.beginFrame()
    i.onPointerDown(1, ...center(r.right!), 'small')
    expect(i.state.right).toBe(true)
  })

  it('버튼 밖을 눌러도 아무 일도 없다', () => {
    const i = createInput()
    i.onPointerDown(1, VIEW_W / 2, 10, 'small')
    expect(i.state).toMatchObject({ left: false, right: false, jump: false })
  })

  it('손가락을 떼면 그 버튼만 꺼진다', () => {
    const i = createInput()
    const r = buttonRects('small')
    i.onPointerDown(1, ...center(r.right!), 'small')
    i.onPointerDown(2, ...center(r.jump!), 'small')
    expect(i.state.right).toBe(true)
    expect(i.state.jump).toBe(true)
    i.onPointerUp(1)
    expect(i.state.right).toBe(false)
    expect(i.state.jump).toBe(true)
  })

  it('버튼 밖으로 슬라이드하면 그 버튼이 꺼진다', () => {
    const i = createInput()
    const r = buttonRects('small')
    i.onPointerDown(1, ...center(r.right!), 'small')
    i.onPointerMove(1, VIEW_W / 2, 10, 'small')
    expect(i.state.right).toBe(false)
  })

  it('슬라이드로 옆 버튼에 들어가면 그 버튼이 켜진다', () => {
    const i = createInput()
    const r = buttonRects('small')
    i.onPointerDown(1, ...center(r.left!), 'small')
    i.onPointerMove(1, ...center(r.right!), 'small')
    expect(i.state.left).toBe(false)
    expect(i.state.right).toBe(true)
  })

  it('추적하지 않는 포인터의 move는 무시한다', () => {
    const i = createInput()
    const r = buttonRects('small')
    i.onPointerMove(99, ...center(r.right!), 'small')
    expect(i.state.right).toBe(false)
  })

  it('좌우를 동시에 누르면 나중에 누른 쪽만 이긴다', () => {
    const i = createInput()
    const r = buttonRects('small')
    i.onPointerDown(1, ...center(r.left!), 'small')
    i.onPointerDown(2, ...center(r.right!), 'small')
    expect(i.state.left).toBe(false)
    expect(i.state.right).toBe(true)
  })

  it('나중에 누른 쪽을 떼면 먼저 누르고 있던 쪽이 되살아난다', () => {
    const i = createInput()
    const r = buttonRects('small')
    i.onPointerDown(1, ...center(r.left!), 'small')
    i.onPointerDown(2, ...center(r.right!), 'small')
    i.onPointerUp(2)
    expect(i.state.left).toBe(true)
    expect(i.state.right).toBe(false)
  })

  it('점프와 이동을 두 손가락으로 동시에 쓸 수 있다', () => {
    const i = createInput()
    const r = buttonRects('small')
    i.onPointerDown(1, ...center(r.right!), 'small')
    i.onPointerDown(2, ...center(r.jump!), 'small')
    expect(i.state.right).toBe(true)
    expect(i.state.jump).toBe(true)
  })

  it('발사 버튼은 ball 상태에서만 눌린다', () => {
    const i = createInput()
    const r = buttonRects('ball')
    i.beginFrame()
    i.onPointerDown(1, ...center(r.fire!), 'small')
    expect(i.state.firePressed).toBe(false)
    i.onPointerUp(1)
    i.onPointerDown(2, ...center(r.fire!), 'ball')
    expect(i.state.firePressed).toBe(true)
  })

  it('firePressed는 endFrame에서 소비된다', () => {
    const i = createInput()
    const r = buttonRects('ball')
    i.onPointerDown(1, ...center(r.fire!), 'ball')
    expect(i.state.firePressed).toBe(true)
    i.endFrame()
    expect(i.state.firePressed).toBe(false)
  })

  it('reset은 모든 입력과 포인터를 지운다', () => {
    const i = createInput()
    const r = buttonRects('small')
    i.onPointerDown(1, ...center(r.right!), 'small')
    i.reset()
    expect(i.state.right).toBe(false)
    i.onPointerUp(1)
    expect(i.state.right).toBe(false)
  })
})
