import type { InputState, PowerState } from '../types'
import { EMPTY_INPUT } from '../types'
import { hitTest, type ButtonId } from '../ui/controls'

export type InputSource = {
  state: InputState
  /** 프레임 시작 */
  beginFrame: () => void
  /** 프레임 끝. 엣지 필드를 소비한다. */
  endFrame: () => void
  onPointerDown: (id: number, px: number, py: number, power: PowerState) => void
  onPointerMove: (id: number, px: number, py: number, power: PowerState) => void
  onPointerUp: (id: number) => void
  onKey: (code: string, down: boolean) => void
  reset: () => void
}

const KEY_MAP: Record<string, ButtonId> = {
  ArrowLeft: 'left',
  ArrowRight: 'right',
  KeyA: 'left',
  KeyD: 'right',
  Space: 'jump',
  ArrowUp: 'jump',
  KeyW: 'jump',
  KeyF: 'fire',
  ShiftLeft: 'fire',
}

export function createInput(): InputSource {
  const state: InputState = { ...EMPTY_INPUT }

  /** pointerId → 현재 누르고 있는 버튼 */
  const pointers = new Map<number, ButtonId>()
  const keys = new Set<ButtonId>()
  /** 좌우 중 나중에 눌린 쪽. 동시 입력 해소용 */
  let lastHorizontal: 'left' | 'right' | null = null

  function held(id: ButtonId): boolean {
    if (keys.has(id)) return true
    for (const b of pointers.values()) if (b === id) return true
    return false
  }

  function recompute(): void {
    const left = held('left')
    const right = held('right')

    if (left && right) {
      // 나중에 눌린 쪽만 살린다
      state.left = lastHorizontal === 'left'
      state.right = lastHorizontal === 'right'
    } else {
      state.left = left
      state.right = right
      // 한쪽만 남았으면 그쪽을 최신으로 잡아, 나중에 누른 쪽을 떼면
      // 먼저 누르고 있던 쪽이 되살아난다.
      if (left) lastHorizontal = 'left'
      else if (right) lastHorizontal = 'right'
      else lastHorizontal = null
    }

    const jump = held('jump')
    if (jump && !state.jump) state.jumpPressed = true
    state.jump = jump
  }

  function press(id: ButtonId): void {
    if (id === 'left' || id === 'right') lastHorizontal = id
    if (id === 'fire') state.firePressed = true
    recompute()
  }

  return {
    state,

    beginFrame(): void {
      // 엣지 필드는 이번 프레임 동안 이벤트로 채워진다
    },

    endFrame(): void {
      state.jumpPressed = false
      state.firePressed = false
    },

    onPointerDown(id, px, py, power): void {
      const btn = hitTest(px, py, power)
      if (!btn) return
      pointers.set(id, btn)
      press(btn)
    },

    onPointerMove(id, px, py, power): void {
      if (!pointers.has(id)) return
      const btn = hitTest(px, py, power)
      const prev = pointers.get(id)!
      if (btn === prev) return
      if (btn === null) {
        pointers.delete(id)
        recompute()
        return
      }
      pointers.set(id, btn)
      press(btn)
    },

    onPointerUp(id): void {
      pointers.delete(id)
      recompute()
    },

    onKey(code, down): void {
      const btn = KEY_MAP[code]
      if (!btn) return
      if (down) {
        if (keys.has(btn)) return // 키 반복 무시
        keys.add(btn)
        press(btn)
      } else {
        keys.delete(btn)
        recompute()
      }
    },

    reset(): void {
      pointers.clear()
      keys.clear()
      lastHorizontal = null
      Object.assign(state, EMPTY_INPUT)
    },
  }
}
