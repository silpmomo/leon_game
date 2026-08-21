import atlasJson from './assets/sprites/atlas.json'
import sheetUrl from './assets/sprites/sprites.png'
import type { LevelData, Mode, Progress } from './types'
import { VIEW_H, VIEW_W } from './engine/tuning'
import { STAGES } from './levels/index'
import { assertValidLevel } from './levels/schema'
import { newGameState, updateFrame } from './game/update'
import { advanceScene, toRecord } from './game/scenes'
import { furthestUnlocked } from './game/unlock'
import { createAudio } from './core/audio'
import { createInput } from './core/input'
import { createLoop } from './core/loop'
import { loadAtlas, type AtlasData, type LoadedAtlas } from './render/atlas'
import { drawControls, drawWorld } from './render/renderer'
import { drawDebug } from './render/debugOverlay'
import { MUTE_RECT, drawHud } from './render/hud'
import { drawRotateOverlay, isPortrait } from './ui/orientation'
import { drawTitle, titleHitTest } from './ui/titleScreen'
import { backHitTest, drawStageSelect, stageHitTest } from './ui/stageSelect'
import { clearHitTest, drawClear } from './ui/clearScreen'
import { loadMuted, loadProgress, saveMuted, saveProgress } from './storage'
import { createPerfWatch, pickScale } from './perf'

const canvas = document.getElementById('game') as HTMLCanvasElement
const ctx = canvas.getContext('2d')!
ctx.imageSmoothingEnabled = false

// 잘못된 레벨로는 부팅하지 않는다. 검은 화면 대신 원인을 보여준다.
try {
  for (const lv of STAGES) assertValidLevel(lv)
} catch (e) {
  document.body.style.cssText =
    'background:#1b1020;color:#fdd;font:12px/1.7 monospace;padding:20px;white-space:pre-wrap'
  document.body.textContent = e instanceof Error ? e.message : String(e)
  throw e
}

const STAGE_IDS = STAGES.map((s) => s.id)

const progress: Record<Mode, Progress> = {
  practice: loadProgress('practice'),
  challenge: loadProgress('challenge'),
}

let mode: Mode = 'practice'
let stageIndex = 0
let state = newGameState(STAGES[0] as LevelData, 'practice')
state.scene = 'title'
state.muted = loadMuted()

/** 시트가 로드될 때까지는 폴백 사각형으로 그린다 */
let atlas: LoadedAtlas = { data: atlasJson as AtlasData, image: null }
void loadAtlas(atlasJson as AtlasData, sheetUrl).then((a) => {
  atlas = a
})

/**
 * ?debug=1 — 히트박스·격자 오버레이와 상수 튜닝 패널.
 * 패널은 동적 import라서 프로덕션 번들에 들어가지 않는다.
 */
const DEBUG = new URLSearchParams(location.search).get('debug') === '1'
if (DEBUG) {
  void import('./ui/tuningPanel').then((m) => {
    m.mountTuningPanel()
  })
}

/** 애니메이션 프레임 카운터 */
let tick = 0

const input = createInput()
const audio = createAudio()
audio.setMuted(state.muted)

/**
 * iOS는 사용자 제스처 안에서 컨텍스트를 만들고 소리를 한 번 내야 재생을
 * 허용한다. 반드시 제스처 핸들러에서 동기적으로 불러야 한다.
 */
let audioUnlocked = false
function unlockAudio(): void {
  if (audioUnlocked) return
  audioUnlocked = true
  audio.unlock()
  void audio.resume().then(() => {
    if (state.scene === 'playing' && !state.muted) audio.startBgm()
  })
}

let scale = 1

/** 저사양 기기에서 프레임이 계속 느리면 렌더 배율을 한 단계 낮춘다 */
const perf = createPerfWatch()
let downgraded = false
let lastFrameAt = 0

function resize(): void {
  scale = pickScale(window.innerWidth, window.innerHeight, downgraded)
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

const modeLabel = (m: Mode): string => (m === 'practice' ? '연습' : '도전')

function startStage(i: number): void {
  const muted = state.muted
  stageIndex = Math.max(0, Math.min(STAGES.length - 1, i))
  state = newGameState(STAGES[stageIndex] as LevelData, mode)
  state.muted = muted
  input.reset()
  audio.unlock()
  audio.play('select')
  if (!muted) audio.startBgm()
}

function goSelect(): void {
  state.scene = 'select'
  audio.stopBgm()
  input.reset()
}

function hasNextStage(): boolean {
  return stageIndex + 1 < STAGES.length
}

function inRect(
  r: { x: number; y: number; w: number; h: number },
  px: number,
  py: number,
): boolean {
  return px >= r.x && px <= r.x + r.w && py >= r.y && py <= r.y + r.h
}

/** 씬 UI 탭 처리. 게임 조작으로 넘길지 여부를 반환한다. */
function handleTap(px: number, py: number): boolean {
  if (inRect(MUTE_RECT, px, py)) {
    state.muted = !state.muted
    saveMuted(state.muted)
    audio.setMuted(state.muted)
    if (state.muted) audio.stopBgm()
    else if (state.scene === 'playing') audio.startBgm()
    return false
  }

  if (state.scene === 'title') {
    const picked = titleHitTest(px, py)
    if (picked) {
      mode = picked
      // 이미 진행한 데까지 열어두고 그 앞에서 시작하게 한다
      stageIndex = furthestUnlocked(STAGE_IDS, progress[mode])
      goSelect()
    }
    return false
  }

  if (state.scene === 'select') {
    if (backHitTest(px, py)) {
      state.scene = 'title'
      input.reset()
      return false
    }
    const i = stageHitTest(px, py, STAGES, progress[mode])
    if (i !== null) startStage(i)
    return false
  }

  if (state.scene === 'clear' || state.scene === 'gameover') {
    const action = clearHitTest(px, py, state.scene === 'clear' && hasNextStage())
    if (action === 'next') startStage(stageIndex + 1)
    else if (action === 'again') startStage(stageIndex)
    else if (action === 'title') goSelect()
    return false
  }

  return true
}

canvas.addEventListener('pointerdown', (e) => {
  e.preventDefault()
  canvas.setPointerCapture(e.pointerId)
  unlockAudio()
  const [px, py] = toLogical(e.clientX, e.clientY)
  if (!handleTap(px, py)) return
  input.onPointerDown(e.pointerId, px, py, state.player.power)
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
  unlockAudio()
  if (state.scene === 'title' && (e.code === 'Space' || e.code === 'Enter')) {
    mode = 'practice'
    stageIndex = furthestUnlocked(STAGE_IDS, progress[mode])
    goSelect()
    return
  }
  if (state.scene === 'select' && (e.code === 'Space' || e.code === 'Enter')) {
    startStage(stageIndex)
    return
  }
  if (state.scene === 'clear' && e.code === 'Space' && hasNextStage()) {
    startStage(stageIndex + 1)
    return
  }
  if (state.scene === 'gameover' && e.code === 'Space') {
    startStage(stageIndex)
    return
  }
  if (e.code === 'Escape') {
    goSelect()
    return
  }
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
    if (state.scene === 'title' || state.scene === 'select') return

    input.beginFrame()
    const events = state.scene === 'playing' ? updateFrame(state, input.state, dt) : []
    for (const e of events) {
      audio.play(e)
      // 전기는 노이즈와 톤을 겹쳐야 100만볼트처럼 들린다
      if (e === 'bolt') audio.play('boltTone')
    }

    const wasClear = state.scene === 'clear'
    advanceScene(state, events, dt)

    if (!wasClear && state.scene === 'clear') {
      const id = STAGES[stageIndex]!.id
      const prev = progress[mode][id] ?? {
        cleared: false,
        bestScore: 0,
        bestTimeMs: 0,
        fewestDeaths: 0,
      }
      progress[mode][id] = toRecord(state, prev)
      saveProgress(mode, progress[mode])
      audio.stopBgm()
    }
    if (state.scene === 'gameover' || state.scene === 'dead') audio.stopBgm()
    else if (state.scene === 'playing' && !state.muted) audio.startBgm()

    input.endFrame()
    tick += 1
  },

  render: () => {
    const now = performance.now()
    if (lastFrameAt > 0 && perf.sample(now - lastFrameAt)) {
      downgraded = true
      resize()
      console.warn('프레임이 계속 느려서 렌더 배율을 낮췄다')
    }
    lastFrameAt = now

    if (isPortrait()) {
      audio.stopBgm()
      drawRotateOverlay(ctx)
      return
    }
    if (state.scene === 'title') {
      drawTitle(ctx, progress, STAGES.length)
      return
    }
    if (state.scene === 'select') {
      drawStageSelect(ctx, STAGES, progress[mode], modeLabel(mode))
      return
    }

    drawWorld(ctx, state, atlas, tick)
    drawHud(ctx, state)
    if (state.scene === 'playing' || state.scene === 'dead') {
      drawControls(ctx, state.player.power)
    }
    if (state.scene === 'clear' || state.scene === 'gameover') {
      drawClear(ctx, state, state.scene === 'clear' && hasNextStage())
    }
    if (DEBUG) drawDebug(ctx, state)
  },
})

// 탭을 벗어나면 BGM을 멈추고 복귀 시 루프 누적자를 초기화한다
document.addEventListener('visibilitychange', () => {
  if (document.hidden) {
    input.reset()
    audio.stopBgm()
  } else {
    loop.reset()
    if (state.scene === 'playing' && !state.muted) audio.startBgm()
  }
})

window.addEventListener('error', (e) => {
  console.error('게임 루프 예외', e.error)
})

resize()
loop.start()
