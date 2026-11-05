import type { Progress } from './types'
import type { ArenaEvent, ArenaInput, ArenaMode, ArenaState } from './arena/types'
import type { Audio } from './core/audio'
import type { LoadedAtlas } from './render/atlas'
import { ARENA_MAPS } from './arena/maps'
import { newArenaState, updateArena } from './arena/update'
import { advanceArenaScene, arenaToRecord } from './arena/scenes'
import { EXIT_RECT, drawArenaHud, drawArenaWorld } from './render/arena'
import {
  ARENA_MAP_IDS, JOY_R, JOY_ZONE_X, arenaBackHitTest, arenaMapHitTest, arenaModeHitTest,
  arenaResultHitTest, drawArenaControls, drawArenaResult, drawArenaSelect, drawArenaTitle,
  fireHitTest, superHitTest, type JoyView,
} from './ui/arenaUi'
import { furthestUnlocked, isUnlocked } from './game/unlock'
import { EMPTY_RECORD, loadProgress, saveProgress } from './storage'

/**
 * 숲속대결 껍데기. main.ts 는 프레임과 입력을 넘기기만 한다.
 * skyApp.ts 와 같은 모양이다.
 */

export const ARENA_GAME_ID = 'arena'

export type ArenaScreen = 'title' | 'select' | 'game'

export type ArenaApp = {
  screen: () => ArenaScreen
  enter: () => void
  update: (dt: number) => void
  render: (ctx: CanvasRenderingContext2D, atlas: LoadedAtlas, tick: number) => void
  pointerDown: (id: number, x: number, y: number) => void
  pointerMove: (id: number, x: number, y: number) => void
  pointerUp: (id: number) => void
  key: (code: string, down: boolean) => boolean
  escape: () => 'hub' | 'stay'
  blur: () => void
  progress: () => Progress
  muteChanged: (muted: boolean) => void
}

const MOVE_KEYS: Record<string, [number, number]> = {
  ArrowLeft: [-1, 0], KeyA: [-1, 0],
  ArrowRight: [1, 0], KeyD: [1, 0],
  ArrowUp: [0, -1], KeyW: [0, -1],
  ArrowDown: [0, 1], KeyS: [0, 1],
}
const FIRE_KEYS = new Set(['Space', 'KeyJ'])
const SUPER_KEYS = new Set(['KeyK', 'KeyX', 'ShiftLeft', 'ShiftRight'])
const GO_KEYS = new Set(['Space', 'Enter'])

function inRect(r: { x: number; y: number; w: number; h: number }, px: number, py: number): boolean {
  return px >= r.x && px <= r.x + r.w && py >= r.y && py <= r.y + r.h
}

export function createArenaApp(audio: Audio): ArenaApp {
  let screen: ArenaScreen = 'title'
  let mode: ArenaMode = 'practice'
  let mapIndex = 0
  let state: ArenaState = newArenaState(ARENA_MAPS[0]!, 'practice')
  let muted = false
  /** 판마다 다른 시작 자리 — 같은 판을 다시 해도 매번 조금 다르다 */
  let round = 0

  const progress: Record<ArenaMode, Progress> = {
    practice: loadProgress(ARENA_GAME_ID, 'practice'),
    challenge: loadProgress(ARENA_GAME_ID, 'challenge'),
  }

  // ── 입력 ────────────────────────────────────────────────
  let joyId: number | null = null
  let joy: JoyView = null
  let fireId: number | null = null
  let superEdge = false
  const held = new Set<string>()

  function resetInput(): void {
    joyId = null
    joy = null
    fireId = null
    superEdge = false
    held.clear()
  }

  function readInput(): ArenaInput {
    let mx = 0
    let my = 0
    for (const code of held) {
      const d = MOVE_KEYS[code]
      if (!d) continue
      mx += d[0]
      my += d[1]
    }
    if (joy) {
      mx += (joy.kx - joy.ox) / JOY_R
      my += (joy.ky - joy.oy) / JOY_R
    }
    const len = Math.hypot(mx, my)
    if (len > 1) {
      mx /= len
      my /= len
    }
    let fireHeld = fireId !== null
    for (const c of FIRE_KEYS) if (held.has(c)) fireHeld = true
    const input: ArenaInput = { mx, my, fire: fireHeld, superPressed: superEdge }
    superEdge = false
    return input
  }

  // ── 진행 ────────────────────────────────────────────────
  function bgm(): void {
    if (!muted) audio.startBgm('sky')
  }

  function startMap(i: number): void {
    mapIndex = Math.max(0, Math.min(ARENA_MAPS.length - 1, i))
    round += 1
    state = newArenaState(ARENA_MAPS[mapIndex]!, mode, (Date.now() + round * 977) & 0x7fffffff)
    state.muted = muted
    screen = 'game'
    resetInput()
    audio.unlock()
    audio.play('select')
    bgm()
  }

  function goSelect(): void {
    screen = 'select'
    audio.stopBgm()
    resetInput()
  }

  function hasNext(): boolean {
    return mapIndex + 1 < ARENA_MAPS.length
      && state.scene === 'clear'
  }

  let shotCount = 0
  function playEvents(events: ArenaEvent[]): void {
    for (const e of events) {
      switch (e) {
        case 'shot':
          shotCount += 1
          if (shotCount % 2 === 0) audio.play('skyShot')
          break
        case 'hit': audio.play('stomp'); break
        case 'crate': audio.play('brick'); break
        case 'gem': audio.play('coin'); break
        case 'kill': audio.play('skyKill'); break
        case 'super':
          audio.play('bolt')
          audio.play('boltTone')
          break
        case 'playerHurt': audio.play('hurt'); break
        case 'die': audio.play('die'); break
        case 'win': audio.play('goal'); break
        case 'gasStart': audio.play('skyAlarm'); break
        default: break
      }
    }
  }

  /** 판이 끝나는 순간 한 번 기록한다 (1등이 아니어도 최고 점수는 남긴다) */
  function saveIfFinished(before: ArenaState['scene']): void {
    const ended = (state.scene === 'clear' && before !== 'clear')
      || (state.scene === 'dead' && before !== 'dead')
    if (!ended) return
    const id = ARENA_MAPS[mapIndex]!.id
    const prev = progress[mode][id] ?? { ...EMPTY_RECORD }
    progress[mode][id] = arenaToRecord(state, prev)
    saveProgress(ARENA_GAME_ID, mode, progress[mode])
    audio.stopBgm()
  }

  function pickMode(m: ArenaMode): void {
    mode = m
    mapIndex = furthestUnlocked(ARENA_MAP_IDS, progress[mode])
    audio.play('select')
    goSelect()
  }

  return {
    screen: () => screen,

    enter(): void {
      screen = 'title'
      resetInput()
      audio.stopBgm()
    },

    muteChanged(v: boolean): void {
      muted = v
      state.muted = v
      if (v) audio.stopBgm()
      else if (screen === 'game' && (state.scene === 'playing' || state.scene === 'countdown')) bgm()
    },

    update(dt: number): void {
      if (screen !== 'game') return
      const before = state.scene
      const events = updateArena(state, readInput(), dt)
      playEvents(events)
      advanceArenaScene(state, events, dt)
      if (before === 'countdown' && state.scene === 'playing') audio.play('select')
      saveIfFinished(before)
    },

    render(ctx, atlas, tick): void {
      if (screen === 'title') {
        drawArenaTitle(ctx, atlas, progress, tick)
        return
      }
      if (screen === 'select') {
        drawArenaSelect(ctx, progress[mode], mode === 'practice' ? '연습' : '도전', mapIndex, tick)
        return
      }
      drawArenaWorld(ctx, state, atlas, tick)
      if (state.scene === 'playing' || state.scene === 'countdown') {
        const p = state.fighters[0]!
        drawArenaControls(ctx, joy, p.ammo, p.superCharge, fireId !== null, tick)
      }
      drawArenaHud(ctx, state, tick)
      if (state.scene === 'clear' || state.scene === 'gameover') {
        drawArenaResult(ctx, state, hasNext())
      }
    },

    pointerDown(id, x, y): void {
      if (screen === 'title') {
        if (arenaBackHitTest(x, y)) return // main 이 허브로 돌린다
        const m = arenaModeHitTest(x, y)
        if (m) pickMode(m)
        return
      }

      if (screen === 'select') {
        if (arenaBackHitTest(x, y)) {
          screen = 'title'
          return
        }
        const i = arenaMapHitTest(x, y, progress[mode])
        if (i !== null) startMap(i)
        return
      }

      if (state.scene === 'clear' || state.scene === 'gameover') {
        const a = arenaResultHitTest(x, y, hasNext())
        if (a === 'next') startMap(mapIndex + 1)
        else if (a === 'again') startMap(mapIndex)
        else if (a === 'select') goSelect()
        return
      }
      if (state.scene === 'dead') return

      if (inRect(EXIT_RECT, x, y)) {
        goSelect()
        return
      }
      if (superHitTest(x, y)) {
        superEdge = true
        return
      }
      if (fireHitTest(x, y)) {
        fireId = id
        return
      }
      if (x < JOY_ZONE_X && joyId === null) {
        joyId = id
        joy = { ox: x, oy: y, kx: x, ky: y }
      }
    },

    pointerMove(id, x, y): void {
      if (screen !== 'game' || joyId !== id || !joy) return
      const dx = x - joy.ox
      const dy = y - joy.oy
      const d = Math.hypot(dx, dy)
      const k = d > JOY_R ? JOY_R / d : 1
      joy.kx = joy.ox + dx * k
      joy.ky = joy.oy + dy * k
    },

    pointerUp(id): void {
      if (joyId === id) {
        joyId = null
        joy = null
      }
      if (fireId === id) fireId = null
    },

    key(code, down): boolean {
      if (screen === 'title') {
        if (down && GO_KEYS.has(code)) {
          pickMode('practice')
          return true
        }
        return false
      }

      if (screen === 'select') {
        if (down && (code === 'ArrowLeft' || code === 'ArrowRight'
            || code === 'ArrowUp' || code === 'ArrowDown')) {
          const step = code === 'ArrowRight' ? 1 : code === 'ArrowLeft' ? -1
            : code === 'ArrowDown' ? 3 : -3
          const next = mapIndex + step
          if (next >= 0 && next < ARENA_MAPS.length
              && isUnlocked(ARENA_MAP_IDS, next, progress[mode])) mapIndex = next
          return true
        }
        if (down && GO_KEYS.has(code)) {
          startMap(mapIndex)
          return true
        }
        return false
      }

      if (state.scene === 'clear' || state.scene === 'gameover') {
        if (down && GO_KEYS.has(code)) {
          if (hasNext()) startMap(mapIndex + 1)
          else startMap(mapIndex)
          return true
        }
        return false
      }

      if (SUPER_KEYS.has(code)) {
        if (down) superEdge = true
        return true
      }
      if (MOVE_KEYS[code] || FIRE_KEYS.has(code)) {
        if (down) held.add(code)
        else held.delete(code)
        return true
      }
      return false
    },

    escape(): 'hub' | 'stay' {
      if (screen === 'game') {
        goSelect()
        return 'stay'
      }
      if (screen === 'select') {
        screen = 'title'
        resetInput()
        return 'stay'
      }
      return 'hub'
    },

    blur(): void {
      resetInput()
    },

    progress(): Progress {
      const a = Object.values(progress.practice).filter((r) => r.cleared).length
      const b = Object.values(progress.challenge).filter((r) => r.cleared).length
      return a >= b ? progress.practice : progress.challenge
    },
  }
}
