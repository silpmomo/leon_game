import atlasJson from './assets/sprites/atlas.json'
import sheetUrl from './assets/sprites/sprites.png'
import type { LevelData, Mode, Progress } from './types'
import { VIEW_H, VIEW_W } from './engine/tuning'
import { STAGES, STAGES_PER_WORLD, WORLD_COUNT, worldOf } from './levels/index'
import { assertValidLevel } from './levels/schema'
import { newGameState, updateFrame } from './game/update'
import { advanceScene, toRecord } from './game/scenes'
import { furthestUnlocked, isUnlocked } from './game/unlock'
import { createAudio } from './core/audio'
import { createInput } from './core/input'
import { createLoop } from './core/loop'
import { loadAtlas, type AtlasData, type LoadedAtlas } from './render/atlas'
import { drawControls, drawWorld } from './render/renderer'
import { drawDebug } from './render/debugOverlay'
import { MUTE_RECT, drawHud } from './render/hud'
import { drawRotateOverlay, isPortrait } from './ui/orientation'
import { drawTitle, hubHitTest, titleHitTest } from './ui/titleScreen'
import { drawGameSelect, firstReadyGame, gameHitTest } from './ui/gameSelect'
import { GAMES } from './games/registry'
import { SKY_GAME_ID, createSkyApp } from './skyApp'
import { SKY_STAGES } from './sky/stages'
import { assertValidSkyStages } from './sky/schema'
import { skyHubHitTest } from './ui/skyUi'
import { ARENA_GAME_ID, createArenaApp } from './arenaApp'
import { ARENA_MAPS } from './arena/maps'
import { assertValidArenaMaps } from './arena/schema'
import { arenaBackHitTest } from './ui/arenaUi'
import {
  backHitTest,
  drawStageSelect,
  stageHitTest,
  worldTabHitTest,
} from './ui/stageSelect'
import { clearHitTest, drawClear } from './ui/clearScreen'
import { loadMuted, loadProgress, saveMuted, saveProgress } from './storage'
import { createPerfWatch, pickScale } from './perf'

const canvas = document.getElementById('game') as HTMLCanvasElement
const ctx = canvas.getContext('2d')!
ctx.imageSmoothingEnabled = false

// 잘못된 레벨로는 부팅하지 않는다. 검은 화면 대신 원인을 보여준다.
try {
  for (const lv of STAGES) assertValidLevel(lv)
  assertValidSkyStages(SKY_STAGES)
  assertValidArenaMaps(ARENA_MAPS)
} catch (e) {
  document.body.style.cssText =
    'background:#1b1020;color:#fdd;font:12px/1.7 monospace;padding:20px;white-space:pre-wrap'
  document.body.textContent = e instanceof Error ? e.message : String(e)
  throw e
}

const STAGE_IDS = STAGES.map((s) => s.id)

/**
 * 지금 어느 게임을 보고 있는가.
 *
 * 'hub' 는 게임 고르기 화면, 나머지는 각 게임이 화면을 통째로 가진다.
 * 기존 게임의 흐름(state.scene)은 그대로 두고 바깥에 한 겹만 씌웠다.
 */
type Route = 'hub' | 'adventure' | 'sky' | 'arena'
let route: Route = 'hub'

const ADVENTURE = 'adventure'
let gameId = ADVENTURE

const progress: Record<Mode, Progress> = {
  practice: loadProgress(ADVENTURE, 'practice'),
  challenge: loadProgress(ADVENTURE, 'challenge'),
}

/** 허브 카드에 보여줄, 게임별 진행도 요약 */
const hubRecords: Record<string, Progress> = { [ADVENTURE]: progress.practice }
const hubTotals: Record<string, number> = {
  [ADVENTURE]: STAGES.length,
  [SKY_GAME_ID]: SKY_STAGES.length,
  [ARENA_GAME_ID]: ARENA_MAPS.length,
}

function refreshHub(): void {
  // 두 모드 중 더 많이 깬 쪽을 대표로 보여준다
  const a = Object.values(progress.practice).filter((r) => r.cleared).length
  const b = Object.values(progress.challenge).filter((r) => r.cleared).length
  hubRecords[ADVENTURE] = a >= b ? progress.practice : progress.challenge
  hubRecords[SKY_GAME_ID] = sky.progress()
  hubRecords[ARENA_GAME_ID] = arena.progress()
}

let mode: Mode = 'practice'
let stageIndex = 0
/** 스테이지 선택 화면에서 보고 있는 월드 (0부터) */
let selWorld = 0
let state = newGameState(STAGES[0] as LevelData, 'practice')
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

const sky = createSkyApp(audio)
sky.muteChanged(state.muted)
const arena = createArenaApp(audio)
arena.muteChanged(state.muted)
refreshHub()

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
    // 하늘전투는 자기 곡을 스스로 켠다. 여기서 켜면 대모험 곡이 겹친다
    if (route === 'adventure' && state.scene === 'playing' && !state.muted) {
      audio.startBgm()
    }
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
  selWorld = worldOf(stageIndex)
  state = newGameState(STAGES[stageIndex] as LevelData, mode)
  state.muted = muted
  input.reset()
  audio.unlock()
  audio.play('select')
  if (!muted) audio.startBgm()
}

/** 월드의 첫 탄이 열려 있는가 */
function isUnlockedWorld(w: number): boolean {
  return isUnlocked(STAGE_IDS, w * STAGES_PER_WORLD, progress[mode])
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
    sky.muteChanged(state.muted)
    arena.muteChanged(state.muted)
    if (state.muted) audio.stopBgm()
    else if (route === 'adventure' && state.scene === 'playing') audio.startBgm()
    return false
  }

  if (route === 'hub') {
    const picked = gameHitTest(px, py)
    if (picked === SKY_GAME_ID) {
      gameId = picked
      route = 'sky'
      sky.enter()
    } else if (picked === ARENA_GAME_ID) {
      gameId = picked
      route = 'arena'
      arena.enter()
    } else if (picked) {
      gameId = picked
      route = 'adventure'
      state.scene = 'title'
      input.reset()
    }
    return false
  }

  if (route === 'sky') {
    // 타이틀 좌상단에서만 허브로 빠진다. 나머지는 하늘전투가 다 처리한다
    if (sky.screen() === 'title' && skyHubHitTest(px, py)) {
      route = 'hub'
      sky.blur()
      refreshHub()
      return false
    }
    return true
  }

  if (route === 'arena') {
    if (arena.screen() === 'title' && arenaBackHitTest(px, py)) {
      route = 'hub'
      arena.blur()
      refreshHub()
      return false
    }
    return true
  }

  if (state.scene === 'title') {
    if (hubHitTest(px, py)) {
      route = 'hub'
      input.reset()
      return false
    }
    const picked = titleHitTest(px, py)
    if (picked) {
      mode = picked
      // 이미 진행한 데까지 열어두고 그 앞에서 시작하게 한다
      stageIndex = furthestUnlocked(STAGE_IDS, progress[mode])
      selWorld = worldOf(stageIndex)
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
    const w = worldTabHitTest(px, py, STAGES, progress[mode], WORLD_COUNT)
    if (w !== null) {
      selWorld = w
      return false
    }
    const i = stageHitTest(px, py, STAGES, progress[mode], selWorld)
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
  if (route === 'sky') {
    sky.pointerDown(e.pointerId, px, py)
    return
  }
  if (route === 'arena') {
    arena.pointerDown(e.pointerId, px, py)
    return
  }
  input.onPointerDown(e.pointerId, px, py, state.player.power)
})
canvas.addEventListener('pointermove', (e) => {
  const [px, py] = toLogical(e.clientX, e.clientY)
  if (route === 'sky') {
    sky.pointerMove(e.pointerId, px, py)
    return
  }
  if (route === 'arena') {
    arena.pointerMove(e.pointerId, px, py)
    return
  }
  input.onPointerMove(e.pointerId, px, py, state.player.power)
})
for (const type of ['pointerup', 'pointercancel', 'lostpointercapture'] as const) {
  canvas.addEventListener(type, (e) => {
    sky.pointerUp(e.pointerId)
    arena.pointerUp(e.pointerId)
    input.onPointerUp(e.pointerId)
  })
}
window.addEventListener('keydown', (e) => {
  unlockAudio()
  if (route === 'hub') {
    if (e.code === 'Space' || e.code === 'Enter') {
      const first = firstReadyGame()
      if (first) {
        gameId = first
        route = first === SKY_GAME_ID ? 'sky' : 'adventure'
        if (route === 'sky') sky.enter()
        else state.scene = 'title'
        input.reset()
      }
    }
    return
  }

  if (route === 'sky') {
    if (e.code === 'Escape') {
      if (sky.escape() === 'hub') {
        route = 'hub'
        refreshHub()
      }
      return
    }
    sky.key(e.code, true)
    return
  }
  if (route === 'arena') {
    if (e.code === 'Escape') {
      if (arena.escape() === 'hub') {
        route = 'hub'
        refreshHub()
      }
      return
    }
    if (arena.key(e.code, true)) e.preventDefault()
    return
  }
  if (state.scene === 'title' && (e.code === 'Space' || e.code === 'Enter')) {
    mode = 'practice'
    stageIndex = furthestUnlocked(STAGE_IDS, progress[mode])
    selWorld = worldOf(stageIndex)
    goSelect()
    return
  }
  // 선택 화면에서 좌우 키로 월드를 넘긴다
  if (state.scene === 'select' && (e.code === 'ArrowLeft' || e.code === 'ArrowRight')) {
    const next = selWorld + (e.code === 'ArrowRight' ? 1 : -1)
    if (next >= 0 && next < WORLD_COUNT
        && isUnlockedWorld(next)) selWorld = next
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
    // 게임 안이면 탄 고르기로, 탄 고르기·타이틀이면 한 단계 위로
    if (state.scene === 'select') state.scene = 'title'
    else if (state.scene === 'title') route = 'hub'
    else goSelect()
    input.reset()
    return
  }
  input.onKey(e.code, true)
})
window.addEventListener('keyup', (e) => {
  if (route === 'sky') {
    sky.key(e.code, false)
    return
  }
  if (route === 'arena') {
    arena.key(e.code, false)
    return
  }
  input.onKey(e.code, false)
})
window.addEventListener('blur', () => {
  input.reset()
  sky.blur()
  arena.blur()
})
window.addEventListener('resize', resize)

const loop = createLoop({
  update: (dt) => {
    if (isPortrait()) return
    if (route === 'hub') return

    if (route === 'sky') {
      // refreshHub 를 매 프레임 부르지 않는다. 허브로 나갈 때만 갱신하면 된다
      sky.update(dt)
      tick += 1
      return
    }
    if (route === 'arena') {
      arena.update(dt)
      tick += 1
      return
    }

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
      saveProgress(gameId, mode, progress[mode])
      refreshHub()
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
    if (route === 'hub') {
      drawGameSelect(ctx, atlas, hubRecords, hubTotals)
      return
    }
    if (route === 'sky') {
      sky.render(ctx, atlas, tick)
      return
    }
    if (route === 'arena') {
      arena.render(ctx, atlas, tick)
      return
    }
    if (state.scene === 'title') {
      drawTitle(ctx, progress, STAGES.length)
      return
    }
    if (state.scene === 'select') {
      drawStageSelect(ctx, STAGES, progress[mode], modeLabel(mode), selWorld, WORLD_COUNT)
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
    sky.blur()
    arena.blur()
    audio.stopBgm()
  } else {
    loop.reset()
    if (route === 'adventure' && state.scene === 'playing' && !state.muted) {
      audio.startBgm()
    }
  }
})

window.addEventListener('error', (e) => {
  console.error('게임 루프 예외', e.error)
})

resize()
loop.start()
