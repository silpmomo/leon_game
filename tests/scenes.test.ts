import { beforeEach, describe, expect, it } from 'vitest'
import {
  CLEAR_MS,
  DEAD_MS,
  advanceScene,
  finalScore,
  respawn,
  toRecord,
} from '../src/game/scenes'
import { EMPTY_RECORD } from '../src/storage'
import { CHALLENGE_TIME_MS, newGameState } from '../src/game/update'
import { SCORE } from '../src/game/score'
import { TILE } from '../src/engine/tuning'
import type { GameState, LevelData } from '../src/types'

const DT = 1 / 60

const LEVEL: LevelData = {
  name: 'test',
  id: 'test',
  theme: 'day',
  width: 30,
  height: 6,
  spawn: { x: 1, y: 4 },
  goal: { x: 28, flagTop: 1 },
  tiles: [
    '..............................',
    '..............................',
    '..............................',
    '..............................',
    '..............................',
    '##############################',
  ],
  entities: [{ type: 'broccoli', x: 20, y: 4, dir: -1 }],
  checkpoints: [10, 20],
}

let s: GameState
beforeEach(() => {
  s = newGameState(LEVEL, 'practice')
})

describe('respawn', () => {
  it('연습 모드는 마지막 체크포인트에서 되살아난다', () => {
    s.checkpointX = 20
    respawn(s)
    expect(Math.floor(s.player.x / TILE)).toBe(20)
    expect(s.player.power).toBe('small')
    expect(s.player.vx).toBe(0)
  })

  it('도전 모드는 항상 스폰 위치로 돌아간다', () => {
    const c = newGameState(LEVEL, 'challenge')
    c.checkpointX = 20
    respawn(c)
    expect(Math.floor(c.player.x / TILE)).toBe(LEVEL.spawn.x)
  })

  it('적이 원래 자리로 되살아난다', () => {
    s.enemies = []
    respawn(s)
    expect(s.enemies).toHaveLength(1)
    expect(s.enemies[0]!.alive).toBe(true)
  })

  it('먹은 코인과 코인 개수는 되돌리지 않는다', () => {
    const before = s.coins.length
    s.coinCount = 7
    respawn(s)
    expect(s.coins.length).toBe(before)
    expect(s.coinCount).toBe(7)
  })

  it('점수는 되돌리지 않는다', () => {
    s.score = 1234
    respawn(s)
    expect(s.score).toBe(1234)
  })

  it('날아가던 공과 아이템은 정리된다', () => {
    s.balls.push({ x: 0, y: 0, vx: 1, vy: 0, w: 12, h: 12, onGround: false, bounces: 0, alive: true })
    respawn(s)
    expect(s.balls).toEqual([])
  })

  it('도전 모드는 시간이 다시 400초가 된다', () => {
    const c = newGameState(LEVEL, 'challenge')
    c.timeMs = 1000
    respawn(c)
    expect(c.timeMs).toBe(CHALLENGE_TIME_MS)
  })
})

describe('advanceScene — 사망', () => {
  it('die 이벤트로 dead 씬에 들어간다', () => {
    advanceScene(s, ['die'], DT)
    expect(s.scene).toBe('dead')
    expect(s.sceneMs).toBe(DEAD_MS)
  })

  it('연습 모드는 목숨이 줄지 않는다', () => {
    advanceScene(s, ['die'], DT)
    expect(s.lives).toBe(Number.POSITIVE_INFINITY)
  })

  it('도전 모드는 목숨이 줄어든다', () => {
    const c = newGameState(LEVEL, 'challenge')
    advanceScene(c, ['die'], DT)
    expect(c.lives).toBe(2)
  })

  it('dead 시간이 끝나면 playing으로 돌아온다', () => {
    advanceScene(s, ['die'], DT)
    for (let i = 0; i < 200 && s.scene === 'dead'; i++) advanceScene(s, [], DT)
    expect(s.scene).toBe('playing')
  })

  it('도전 모드에서 목숨이 다 떨어지면 gameover가 된다', () => {
    const c = newGameState(LEVEL, 'challenge')
    c.lives = 1
    advanceScene(c, ['die'], DT)
    for (let i = 0; i < 200 && c.scene === 'dead'; i++) advanceScene(c, [], DT)
    expect(c.scene).toBe('gameover')
  })

  it('dead 씬에서는 die 이벤트를 다시 받지 않는다', () => {
    advanceScene(s, ['die'], DT)
    const lives0 = s.lives
    advanceScene(s, ['die'], DT)
    expect(s.lives).toBe(lives0)
    expect(s.scene).toBe('dead')
  })

  it('부활하면 체크포인트 위치에서 시작한다', () => {
    s.checkpointX = 20
    advanceScene(s, ['die'], DT)
    for (let i = 0; i < 200 && s.scene === 'dead'; i++) advanceScene(s, [], DT)
    expect(Math.floor(s.player.x / TILE)).toBe(20)
  })
})

describe('advanceScene — 클리어', () => {
  it('goal 이벤트로 clear 씬에 들어간다', () => {
    advanceScene(s, ['goal'], DT)
    expect(s.scene).toBe('clear')
    expect(s.sceneMs).toBe(CLEAR_MS)
  })

  it('깃대 높이 보너스가 점수에 더해진다', () => {
    s.player.y = LEVEL.goal.flagTop * TILE // 맨 위에서 잡음
    advanceScene(s, ['goal'], DT)
    expect(s.score).toBeGreaterThanOrEqual(SCORE.flagMax)
  })

  it('바닥에서 잡으면 깃대 보너스가 없다', () => {
    s.player.y = (LEVEL.height - 2) * TILE
    advanceScene(s, ['goal'], DT)
    expect(s.score).toBe(0)
  })

  it('도전 모드는 남은 시간 보너스도 더해진다', () => {
    const c = newGameState(LEVEL, 'challenge')
    c.timeMs = 100_000
    c.player.y = (LEVEL.height - 2) * TILE
    advanceScene(c, ['goal'], DT)
    expect(c.score).toBeGreaterThanOrEqual(100 * SCORE.timeBonusPerSec)
  })

  it('연습 모드는 시간 보너스가 없다', () => {
    s.timeMs = 100_000 // 연습은 경과 시간
    s.player.y = (LEVEL.height - 2) * TILE
    advanceScene(s, ['goal'], DT)
    expect(s.score).toBe(0)
  })

  it('clear 씬은 끝나도 자동으로 넘어가지 않는다 (사용자 입력 대기)', () => {
    advanceScene(s, ['goal'], DT)
    for (let i = 0; i < 400; i++) advanceScene(s, [], DT)
    expect(s.scene).toBe('clear')
  })

  it('클리어가 사망보다 우선한다', () => {
    advanceScene(s, ['goal', 'die'], DT)
    expect(s.scene).toBe('clear')
  })
})

describe('finalScore / toRecord', () => {
  it('점수를 그대로 쓴다', () => {
    s.score = 1234
    expect(finalScore(s)).toBe(1234)
  })

  it('첫 클리어를 기록한다', () => {
    s.scene = 'clear'
    s.score = 500
    s.timeMs = 90_000
    s.deaths = 2
    const r = toRecord(s, EMPTY_RECORD)
    expect(r.cleared).toBe(true)
    expect(r.bestScore).toBe(500)
    expect(r.fewestDeaths).toBe(2)
    expect(r.bestTimeMs).toBe(90_000)
  })

  it('더 나쁜 기록은 덮어쓰지 않는다', () => {
    s.scene = 'clear'
    s.score = 100
    s.deaths = 9
    s.timeMs = 200_000
    const prev = { cleared: true, bestScore: 900, bestTimeMs: 50_000, fewestDeaths: 1 }
    const r = toRecord(s, prev)
    expect(r.bestScore).toBe(900)
    expect(r.fewestDeaths).toBe(1)
    expect(r.bestTimeMs).toBe(50_000)
  })

  it('더 좋은 기록은 갱신한다', () => {
    s.scene = 'clear'
    s.score = 2000
    s.deaths = 0
    s.timeMs = 30_000
    const prev = { cleared: true, bestScore: 900, bestTimeMs: 50_000, fewestDeaths: 1 }
    const r = toRecord(s, prev)
    expect(r.bestScore).toBe(2000)
    expect(r.fewestDeaths).toBe(0)
    expect(r.bestTimeMs).toBe(30_000)
  })

  it('연습 모드 클리어 시간은 경과 시간을 쓴다', () => {
    s.scene = 'clear'
    s.timeMs = 123_000
    expect(toRecord(s, EMPTY_RECORD).bestTimeMs).toBe(123_000)
  })

  it('도전 모드 클리어 시간은 400초에서 남은 시간을 뺀 값이다', () => {
    const c = newGameState(LEVEL, 'challenge')
    c.scene = 'clear'
    c.timeMs = 300_000
    expect(toRecord(c, EMPTY_RECORD).bestTimeMs).toBe(100_000)
  })

  it('클리어하지 않았으면 기록을 바꾸지 않는다', () => {
    s.scene = 'gameover'
    s.score = 9999
    expect(toRecord(s, EMPTY_RECORD)).toEqual(EMPTY_RECORD)
  })
})

describe('EMPTY_RECORD', () => {
  it('미클리어 상태로 시작한다', () => {
    expect(EMPTY_RECORD.cleared).toBe(false)
    expect(EMPTY_RECORD.bestScore).toBe(0)
  })
})
