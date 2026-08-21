import { TILE } from '../../src/engine/tuning'
import { newGameState, updateFrame } from '../../src/game/update'
import { advanceScene } from '../../src/game/scenes'
import { EMPTY_INPUT, type GameState, type InputState, type LevelData } from '../../src/types'

const DT = 1 / 60

/** 앞에 벽으로 취급할 타일 */
const WALL = new Set(['#', 'H', 'p', '|', 'B', 'b', '?', '@', '*', 'S'])

export type BotConfig = {
  /** 점프 버튼을 유지하는 프레임 수 */
  hold: number
  /** 나는 적을 피해 멈춰 기다리는 최대 프레임 */
  waitCap: number
}

export type BotResult = {
  goal: boolean
  maxTx: number
  deaths: number
  frames: number
  cause: string
}

function tileAtRow(lv: LevelData, row: number, tx: number): string {
  return lv.tiles[row]?.[tx] ?? '.'
}

/** tx 열을 걸어서 지날 수 있는가 (구덩이·용암·가시가 아님) */
function walkable(lv: LevelData, tx: number): boolean {
  return tileAtRow(lv, 10, tx) === '#' && tileAtRow(lv, 9, tx) !== '^'
}

function deathCause(s: GameState, lv: LevelData): string {
  const p = s.player
  const tx = Math.floor((p.x + p.w / 2) / TILE)
  if (p.y > lv.height * TILE) return `낙하@${tx}`
  if (tileAtRow(lv, 10, tx) === '~') return `용암@${tx}`
  if (tileAtRow(lv, 9, tx) === '^') return `가시@${tx}`
  const near = s.enemies.filter((e) => e.alive && Math.abs(e.x - p.x) < 26)
  if (near.length) return `${near.map((e) => e.kind).join('/')}@${tx}`
  return `불명@${tx}`
}

/**
 * 스테이지를 실제로 플레이해보는 봇.
 *
 * 사람만큼 잘 하지는 못하지만, 지형·물리를 바꿔 통과가 불가능해지면
 * 완주에 실패한다. "그냥 오른쪽으로 달리는" 봇으로는 적과 용암이 있는
 * 스테이지를 못 지나서 레벨 문제와 봇 한계를 구분할 수 없었다.
 */
export function playStage(lv: LevelData, cfg: BotConfig): BotResult {
  const s = newGameState(lv, 'practice')
  let hold = 0
  let wait = 0
  let maxTx = 0
  let stuckFrames = 0
  let lastX = s.player.x
  let cause = '시간초과'

  const MAX_FRAMES = 60 * 400

  for (let i = 0; i < MAX_FRAMES; i++) {
    const p = s.player
    const cx = p.x + p.w / 2
    const tx = Math.floor(cx / TILE)
    maxTx = Math.max(maxTx, tx)

    // ── 앞쪽 지형 살피기. 가시·구덩이·용암을 모두 "못 걷는 칸"으로 본다
    const edgeTx = Math.floor((p.x + p.w + 2) / TILE)
    let gapAt = -1
    for (let d = 0; d <= 3; d++) {
      if (!walkable(lv, edgeTx + d)) {
        gapAt = d
        break
      }
    }
    // 발판 위에 서 있으면 다음 발판·지면이 사정거리에 올 때까지 기다린다
    const onPlatform = s.platforms.some(
      (pf) =>
        Math.abs(p.y + p.h - pf.y) <= 3 && p.x + p.w > pf.x && p.x < pf.x + pf.w,
    )
    const wallAhead = WALL.has(tileAtRow(lv, 9, edgeTx)) || WALL.has(tileAtRow(lv, 9, edgeTx + 1))

    // ── 적 살피기
    const alive = s.enemies.filter((e) => e.alive && e.active && e.squashMs === 0)
    const aheadGround = alive.find(
      (e) =>
        (e.kind === 'broccoli' || e.kind === 'soup')
        && e.x + e.w > p.x
        && e.x - (p.x + p.w) < 3 * TILE
        && Math.abs(e.y - p.y) < 2.5 * TILE,
    )
    const aheadHard = alive.find(
      (e) =>
        (e.kind === 'crocodile' || e.kind === 'boss')
        && e.x + e.w > p.x
        && e.x - (p.x + p.w) < 4.5 * TILE
        && Math.abs(e.y - p.y) < 3 * TILE,
    )
    const flyerNear = alive.find(
      (e) =>
        e.kind === 'flyer'
        && e.x + e.w > p.x - TILE
        && e.x - (p.x + p.w) < 2.5 * TILE
        && Math.abs(e.y + e.h - (p.y + p.h)) < 1.8 * TILE,
    )

    // ── 결정
    let goRight = true
    let wantJump = false

    if (gapAt >= 0 || wallAhead) {
      // 발판 위라면 바로 뛰지 않고 한 칸 앞까지 걸어가 발판 끝에서 뛴다
      wantJump = !onPlatform || gapAt <= 1
    } else if (aheadGround) {
      // 밟아서 없앤다
      wantJump = true
    } else if (aheadHard) {
      // 밟을 수 없는 적 — 뛰어넘고, 공이 있으면 쏜다
      wantJump = true
    } else if (flyerNear && wait < cfg.waitCap) {
      // 나는 적은 지나가게 두는 편이 안전하다
      goRight = false
      wait += 1
    } else {
      wait = 0
    }

    // 진행이 막히면(벽·발판 대기) 뛰어본다
    if (Math.abs(p.x - lastX) < 0.05) stuckFrames += 1
    else stuckFrames = 0
    lastX = p.x
    if (stuckFrames > 24) {
      wantJump = true
      stuckFrames = 0
    }

    if (wantJump && p.onGround) hold = cfg.hold
    const justPressed = hold === cfg.hold && wantJump && p.onGround
    if (hold > 0) hold -= 1

    const input: InputState = {
      ...EMPTY_INPUT,
      right: goRight,
      jump: hold > 0,
      jumpPressed: justPressed,
      firePressed: p.power === 'ball',
    }

    const events = s.scene === 'playing' ? updateFrame(s, input, DT) : []
    advanceScene(s, events, DT)

    if (events.includes('goal')) {
      return { goal: true, maxTx, deaths: s.deaths, frames: i, cause: '골' }
    }
    if (events.includes('die')) {
      cause = deathCause(s, lv)
      // 연습 모드는 체크포인트에서 부활한다. 봇도 계속 도전한다.
      if (s.deaths > 30) break
    }
  }

  return { goal: false, maxTx, deaths: s.deaths, frames: MAX_FRAMES, cause }
}

/** 여러 설정으로 시도해 하나라도 완주하면 성공 */
export function canComplete(lv: LevelData): BotResult {
  let best: BotResult = {
    goal: false, maxTx: 0, deaths: 0, frames: 0, cause: '미시도',
  }
  for (const hold of [18, 14, 22, 11, 26]) {
    for (const waitCap of [40, 0]) {
      const r = playStage(lv, { hold, waitCap })
      if (r.goal) return r
      if (r.maxTx > best.maxTx) best = r
    }
  }
  return best
}
