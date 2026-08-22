import type { Progress } from './types'
import type { SkyEvent, SkyMode, SkyState } from './sky/types'
import type { SkyInput } from './sky/player'
import type { Audio } from './core/audio'
import type { LoadedAtlas } from './render/atlas'
import { SKY_STAGES } from './sky/stages'
import { newSkyState, updateSky } from './sky/update'
import { advanceSkyScene, skyToRecord } from './sky/scenes'
import { BOUND } from './sky/tuning'
import { drawSkyHud, drawSkyWorld } from './render/sky'
import { bombHitTest, drawSkyControls } from './ui/skyControls'
import {
  SKY_STAGE_IDS, drawSkyDead, drawSkyResult, drawSkySelect, drawSkyTitle,
  skyHubHitTest, skyModeHitTest, skyResultHitTest, skyStageHitTest,
} from './ui/skyUi'
import { furthestUnlocked, isUnlocked } from './game/unlock'
import { EMPTY_RECORD, loadProgress, saveProgress } from './storage'

/**
 * 하늘전투를 하나로 묶는 껍데기.
 *
 * main.ts 는 이 객체에 프레임과 입력을 넘기기만 한다. 기존 게임의 흐름은
 * 손대지 않고 옆에 나란히 둔다.
 */

export const SKY_GAME_ID = 'sky'

export type SkyScreen = 'title' | 'select' | 'game'

export type SkyApp = {
  screen: () => SkyScreen
  /** 허브에서 들어올 때 */
  enter: () => void
  update: (dt: number) => void
  render: (ctx: CanvasRenderingContext2D, atlas: LoadedAtlas, tick: number) => void
  pointerDown: (id: number, x: number, y: number) => void
  pointerMove: (id: number, x: number, y: number) => void
  pointerUp: (id: number) => void
  /** true 면 이 앱이 키를 먹었다 */
  key: (code: string, down: boolean) => boolean
  /** 한 단계 위로. 'hub' 면 main 이 허브로 돌린다 */
  escape: () => 'hub' | 'stay'
  /** 화면이 안 보이게 될 때 (탭 전환 등) */
  blur: () => void
  /** 허브 카드에 보여줄 진행도 */
  progress: () => Progress
  muteChanged: (muted: boolean) => void
}

const MOVE_KEYS: Record<string, [number, number]> = {
  ArrowLeft: [-1, 0], KeyA: [-1, 0],
  ArrowRight: [1, 0], KeyD: [1, 0],
  ArrowUp: [0, -1], KeyW: [0, -1],
  ArrowDown: [0, 1], KeyS: [0, 1],
}

const BOMB_KEYS = new Set(['Space', 'KeyX', 'KeyZ', 'Enter'])

export function createSkyApp(audio: Audio): SkyApp {
  let screen: SkyScreen = 'title'
  let mode: SkyMode = 'practice'
  let stageIndex = 0
  let state: SkyState = newSkyState(SKY_STAGES[0]!, 'practice')
  let muted = false

  const progress: Record<SkyMode, Progress> = {
    practice: loadProgress(SKY_GAME_ID, 'practice'),
    challenge: loadProgress(SKY_GAME_ID, 'challenge'),
  }

  // ── 입력 ────────────────────────────────────────────────
  /** 캐릭터를 끄는 손가락. 궁극기 버튼을 누른 손가락과 구분한다 */
  let dragId: number | null = null
  let grabX = 0
  let grabY = 0
  let baseX = 0
  let baseY = 0
  let targetX: number | null = null
  let targetY: number | null = null
  let bombEdge = false
  const held = new Set<string>()

  function resetInput(): void {
    dragId = null
    targetX = null
    targetY = null
    bombEdge = false
    held.clear()
  }

  function clamp(v: number, a: number, b: number): number {
    return v < a ? a : v > b ? b : v
  }

  function readInput(): SkyInput {
    let ax = 0
    let ay = 0
    for (const code of held) {
      const d = MOVE_KEYS[code]
      if (!d) continue
      ax += d[0]
      ay += d[1]
    }
    const len = Math.hypot(ax, ay)
    if (len > 1) {
      ax /= len
      ay /= len
    }
    const input: SkyInput = { tx: targetX, ty: targetY, ax, ay, bomb: bombEdge }
    bombEdge = false
    return input
  }

  // ── 진행 ────────────────────────────────────────────────
  function bgm(): void {
    if (!muted) audio.startBgm('sky')
  }

  function startStage(i: number): void {
    stageIndex = clamp(i, 0, SKY_STAGES.length - 1)
    state = newSkyState(SKY_STAGES[stageIndex]!, mode)
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
    return stageIndex + 1 < SKY_STAGES.length
  }

  /** 발사음은 초당 10발이라 그대로 내면 시끄럽다. 넷에 한 번만 낸다 */
  let shotCount = 0

  function playEvents(events: SkyEvent[]): void {
    for (const e of events) {
      switch (e) {
        case 'shot':
          shotCount += 1
          if (shotCount % 4 === 0) audio.play('skyShot')
          break
        case 'kill': audio.play('skyKill'); break
        case 'power': audio.play('powerup'); break
        case 'coin': audio.play('coin'); break
        case 'extra': audio.play('extraLife'); break
        case 'bossIn': audio.play('skyAlarm'); break
        case 'bossDown': audio.play('bossDown'); break
        case 'die': audio.play('die'); break
        case 'clear': audio.play('goal'); break
        case 'bomb':
          audio.play('bolt')
          audio.play('boltTone')
          break
        default:
          break
      }
    }
  }

  function saveIfCleared(before: SkyState['scene']): void {
    if (before === 'clear' || state.scene !== 'clear') return
    const id = SKY_STAGES[stageIndex]!.id
    const prev = progress[mode][id] ?? { ...EMPTY_RECORD }
    progress[mode][id] = skyToRecord(state, prev)
    saveProgress(SKY_GAME_ID, mode, progress[mode])
    audio.stopBgm()
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
      else if (screen === 'game' && state.scene === 'playing') bgm()
    },

    update(dt: number): void {
      if (screen !== 'game') return
      const before = state.scene
      const events = state.scene === 'playing'
        ? updateSky(state, readInput(), dt)
        : []
      playEvents(events)
      advanceSkyScene(state, events, dt)
      saveIfCleared(before)

      if (state.scene === 'gameover') audio.stopBgm()
      else if (state.scene === 'playing' && !muted) bgm()
    },

    render(ctx, atlas, tick): void {
      if (screen === 'title') {
        drawSkyTitle(ctx, atlas, progress, tick)
        return
      }
      if (screen === 'select') {
        drawSkySelect(ctx, progress[mode], mode === 'practice' ? '연습' : '도전', tick)
        return
      }
      drawSkyWorld(ctx, state, atlas, tick)
      drawSkyHud(ctx, state)
      if (state.scene === 'playing' || state.scene === 'dead') {
        drawSkyControls(ctx, state.player.bombs, tick)
      }
      if (state.scene === 'dead') drawSkyDead(ctx, state)
      if (state.scene === 'clear' || state.scene === 'gameover') {
        drawSkyResult(ctx, state, state.scene === 'clear' && hasNext())
      }
    },

    pointerDown(id, x, y): void {
      if (screen === 'title') {
        if (skyHubHitTest(x, y)) return
        const m = skyModeHitTest(x, y)
        if (m) {
          mode = m
          stageIndex = furthestUnlocked(SKY_STAGE_IDS, progress[mode])
          audio.play('select')
          goSelect()
        }
        return
      }

      if (screen === 'select') {
        if (skyHubHitTest(x, y)) {
          screen = 'title'
          return
        }
        const i = skyStageHitTest(x, y, progress[mode])
        if (i !== null) startStage(i)
        return
      }

      if (state.scene === 'clear' || state.scene === 'gameover') {
        const a = skyResultHitTest(x, y, state.scene === 'clear' && hasNext())
        if (a === 'next') startStage(stageIndex + 1)
        else if (a === 'again') startStage(stageIndex)
        else if (a === 'select') goSelect()
        return
      }

      if (bombHitTest(x, y)) {
        bombEdge = true
        return
      }

      // 나머지 손가락이 캐릭터를 끈다. 손가락 자리로 순간이동시키지 않고
      // 집은 순간부터의 이동량만 더한다 — 손이 캐릭터를 가리지 않는다
      dragId = id
      grabX = x
      grabY = y
      baseX = state.player.x
      baseY = state.player.y
      targetX = baseX
      targetY = baseY
    },

    pointerMove(id, x, y): void {
      if (screen !== 'game' || dragId !== id) return
      targetX = clamp(baseX + (x - grabX), BOUND.x0, BOUND.x1)
      targetY = clamp(baseY + (y - grabY), BOUND.y0, BOUND.y1)
    },

    pointerUp(id): void {
      if (dragId === id) {
        dragId = null
        targetX = null
        targetY = null
      }
    },

    key(code, down): boolean {
      if (screen === 'title') {
        if (down && BOMB_KEYS.has(code)) {
          mode = 'practice'
          stageIndex = furthestUnlocked(SKY_STAGE_IDS, progress[mode])
          goSelect()
          return true
        }
        return false
      }

      if (screen === 'select') {
        if (down && (code === 'ArrowLeft' || code === 'ArrowRight')) {
          const next = stageIndex + (code === 'ArrowRight' ? 1 : -1)
          if (next >= 0 && next < SKY_STAGES.length
              && isUnlocked(SKY_STAGE_IDS, next, progress[mode])) stageIndex = next
          return true
        }
        if (down && BOMB_KEYS.has(code)) {
          startStage(stageIndex)
          return true
        }
        return false
      }

      if (state.scene === 'clear' || state.scene === 'gameover') {
        if (down && BOMB_KEYS.has(code)) {
          if (state.scene === 'clear' && hasNext()) startStage(stageIndex + 1)
          else startStage(stageIndex)
          return true
        }
        return false
      }

      if (BOMB_KEYS.has(code)) {
        if (down) bombEdge = true
        return true
      }
      if (MOVE_KEYS[code]) {
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

    /** 두 모드 중 더 많이 깬 쪽을 허브에 보여준다 */
    progress(): Progress {
      const a = Object.values(progress.practice).filter((r) => r.cleared).length
      const b = Object.values(progress.challenge).filter((r) => r.cleared).length
      return a >= b ? progress.practice : progress.challenge
    },
  }
}
