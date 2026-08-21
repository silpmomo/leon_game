import { beforeEach, describe, expect, it } from 'vitest'
import { CHALLENGE_TIME_MS, MAX_BALLS, newGameState, updateFrame } from '../src/game/update'
import { TILE } from '../src/engine/tuning'
import { EMPTY_INPUT, type GameState, type InputState, type LevelData } from '../src/types'

const DT = 1 / 60
const input = (over: Partial<InputState> = {}): InputState => ({ ...EMPTY_INPUT, ...over })

const LEVEL: LevelData = {
  name: 'test',
  id: 'test',
  theme: 'day',
  width: 20,
  height: 6,
  spawn: { x: 2, y: 4 },
  goal: { x: 18, flagTop: 1 },
  tiles: [
    '....................',
    '....................',
    '.....?..............',
    '....................',
    '....................',
    '########....########',
  ],
  entities: [
    { type: 'broccoli', x: 10, y: 4, dir: -1 },
    { type: 'platform', x: 9, y: 4, axis: 'x', range: 2, speed: 40 },
  ],
  checkpoints: [10],
}

let s: GameState
beforeEach(() => {
  s = newGameState(LEVEL, 'practice')
})

describe('newGameState', () => {
  it('레벨에서 적·발판·코인을 만든다', () => {
    expect(s.enemies).toHaveLength(1)
    expect(s.platforms).toHaveLength(1)
    expect(s.scene).toBe('playing')
  })

  it('스폰 위치에 플레이어를 둔다', () => {
    expect(s.player.y + s.player.h).toBe(5 * TILE)
    expect(s.checkpointX).toBe(LEVEL.spawn.x)
  })

  it('도전 모드는 400초로 시작하고 연습 모드는 0에서 올라간다', () => {
    expect(newGameState(LEVEL, 'challenge').timeMs).toBe(CHALLENGE_TIME_MS)
    expect(newGameState(LEVEL, 'practice').timeMs).toBe(0)
  })

  it('연습 모드는 목숨이 무한이다', () => {
    expect(newGameState(LEVEL, 'practice').lives).toBe(Number.POSITIVE_INFINITY)
    expect(newGameState(LEVEL, 'challenge').lives).toBe(3)
  })
})

describe('updateFrame — 순서와 배선', () => {
  it('중력이 걸려 바닥에 정착한다', () => {
    for (let i = 0; i < 40; i++) updateFrame(s, input(), DT)
    expect(s.player.onGround).toBe(true)
  })

  it('카메라가 플레이어를 따라간다', () => {
    // 레벨이 뷰포트(416px = 26타일)보다 넓어야 카메라가 움직일 여지가 생긴다.
    const wide: LevelData = {
      ...LEVEL,
      width: 60,
      tiles: [
        '.'.repeat(60),
        '.'.repeat(60),
        '.'.repeat(60),
        '.'.repeat(60),
        '.'.repeat(60),
        '#'.repeat(60),
      ],
      entities: [],
      goal: { x: 58, flagTop: 1 },
    }
    const g = newGameState(wide, 'practice')
    for (let i = 0; i < 30; i++) updateFrame(g, input(), DT)
    const c0 = g.camera.x
    for (let i = 0; i < 200; i++) updateFrame(g, input({ right: true }), DT)
    expect(g.camera.x).toBeGreaterThan(c0)
  })

  it('연습 모드는 시간이 올라가고 도전 모드는 내려간다', () => {
    for (let i = 0; i < 60; i++) updateFrame(s, input(), DT)
    expect(s.timeMs).toBeGreaterThan(0)

    const c = newGameState(LEVEL, 'challenge')
    for (let i = 0; i < 60; i++) updateFrame(c, input(), DT)
    expect(c.timeMs).toBeLessThan(CHALLENGE_TIME_MS)
  })

  it('시야에 들어온 적이 활성화된다', () => {
    updateFrame(s, input(), DT)
    expect(s.enemies[0]!.active).toBe(true)
  })

  it('점프하면 jump 이벤트가 나온다', () => {
    for (let i = 0; i < 40; i++) updateFrame(s, input(), DT)
    const ev = updateFrame(s, input({ jump: true, jumpPressed: true }), DT)
    expect(ev).toContain('jump')
  })

  it('구덩이에 떨어지면 die 이벤트가 나온다', () => {
    // 타일 8은 구덩이이면서 이동발판(타일 9~11) 밖이다.
    // 타일 9에 두면 발판 위에 착지해 죽지 않는다.
    s.player.x = 8 * TILE
    s.player.y = 0
    let died = false
    for (let i = 0; i < 300 && !died; i++) {
      died = updateFrame(s, input(), DT).includes('die')
    }
    expect(died).toBe(true)
    expect(s.deaths).toBe(1)
  })

  it('구덩이 위에 발판이 있으면 그 위에 착지해 죽지 않는다', () => {
    const pf = s.platforms[0]!
    s.player.x = pf.x + 8
    s.player.y = 0
    let died = false
    for (let i = 0; i < 120 && !died; i++) {
      died = updateFrame(s, input(), DT).includes('die')
    }
    expect(died).toBe(false)
    expect(s.player.onGround).toBe(true)
  })

  it('천장 블록을 치면 hitBlock이 발동한다', () => {
    // ? 블록은 (5, 2). 그 아래에서 점프한다.
    s.player.x = 5 * TILE + 2
    for (let i = 0; i < 40; i++) updateFrame(s, input(), DT)
    let coined = false
    for (let i = 0; i < 60 && !coined; i++) {
      const ev = updateFrame(s, input({ jump: true, jumpPressed: i === 0 }), DT)
      if (ev.includes('coin')) coined = true
    }
    expect(coined).toBe(true)
  })

  it('깃대를 지나면 goal 이벤트가 한 번만 나온다', () => {
    s.player.x = 18 * TILE
    const first = updateFrame(s, input(), DT)
    expect(first).toContain('goal')
    expect(s.player.sliding).toBe(true)
    const second = updateFrame(s, input(), DT)
    expect(second).not.toContain('goal')
  })

  it('슬라이딩 중에는 조작이 먹지 않는다', () => {
    s.player.x = 18 * TILE
    updateFrame(s, input(), DT)
    expect(s.player.sliding).toBe(true)
    const vx0 = s.player.vx
    updateFrame(s, input({ right: true }), DT)
    expect(Math.abs(s.player.vx)).toBeLessThanOrEqual(Math.abs(vx0))
  })
})

describe('updateFrame — 이동발판 탑승', () => {
  function rideSetup(): GameState {
    const g = newGameState(LEVEL, 'practice')
    const pf = g.platforms[0]!
    g.player.x = pf.x + 8
    g.player.y = pf.y - g.player.h
    g.player.vy = 1
    updateFrame(g, input(), DT)
    return g
  }

  it('가로 발판 위에 서면 함께 이동한다', () => {
    const g = rideSetup()
    const pf = g.platforms[0]!
    expect(g.player.onGround).toBe(true)
    const px0 = g.player.x
    const pfx0 = pf.x
    updateFrame(g, input(), DT)
    expect(g.player.x - px0).toBeCloseTo(pf.x - pfx0, 3)
  })

  it('발판 위에 서면 코요테 타임이 채워진다', () => {
    const g = rideSetup()
    expect(g.player.coyoteMs).toBeGreaterThan(0)
  })

  it('발판 아래에서 위로는 통과한다 (단방향)', () => {
    const g = newGameState(LEVEL, 'practice')
    const pf = g.platforms[0]!
    g.player.x = pf.x + 8
    g.player.y = pf.y + 20
    const y0 = g.player.y
    for (let i = 0; i < 3; i++) {
      g.player.vy = -200
      updateFrame(g, input(), DT)
    }
    expect(g.player.y).toBeLessThan(y0)
  })
})

describe('updateFrame — 축구공 발사', () => {
  it('ball 상태에서 발사 입력이 공을 만든다', () => {
    s.player.power = 'ball'
    updateFrame(s, input({ firePressed: true }), DT)
    expect(s.balls).toHaveLength(1)
  })

  it('small 상태에서는 발사되지 않는다', () => {
    updateFrame(s, input({ firePressed: true }), DT)
    expect(s.balls).toHaveLength(0)
  })

  it('fire 이벤트가 나온다', () => {
    s.player.power = 'ball'
    expect(updateFrame(s, input({ firePressed: true }), DT)).toContain('fire')
  })

  it('동시에 2개까지만 존재한다', () => {
    s.player.power = 'ball'
    for (let i = 0; i < 5; i++) updateFrame(s, input({ firePressed: true }), DT)
    expect(s.balls.filter((b) => b.alive).length).toBeLessThanOrEqual(MAX_BALLS)
  })

  it('죽은 공은 목록에서 정리된다', () => {
    s.player.power = 'ball'
    updateFrame(s, input({ firePressed: true }), DT)
    s.balls[0]!.alive = false
    updateFrame(s, input(), DT)
    expect(s.balls).toHaveLength(0)
  })
})

describe('updateFrame — 정리', () => {
  it('사라진 적과 먹은 코인이 목록에서 빠진다', () => {
    s.enemies[0]!.alive = false
    s.coins.push({ x: -100, y: -100, w: 10, h: 14, taken: true })
    updateFrame(s, input(), DT)
    expect(s.enemies).toHaveLength(0)
    expect(s.coins.every((c) => !c.taken)).toBe(true)
  })

  it('bump 애니메이션 타이머가 줄고 만료되면 사라진다', () => {
    s.bumps.push({ tx: 1, ty: 1, ms: 20 })
    updateFrame(s, input(), DT)
    updateFrame(s, input(), DT)
    expect(s.bumps).toHaveLength(0)
  })

  it('체크포인트를 지나면 checkpointX가 갱신된다', () => {
    s.player.x = 11 * TILE
    updateFrame(s, input(), DT)
    expect(s.checkpointX).toBe(10)
  })

  it('체크포인트는 뒤로 돌아가지 않는다', () => {
    s.player.x = 11 * TILE
    updateFrame(s, input(), DT)
    s.player.x = 0
    updateFrame(s, input(), DT)
    expect(s.checkpointX).toBe(10)
  })

  it('도전 모드에서 시간이 0이 되면 die가 나온다', () => {
    const c = newGameState(LEVEL, 'challenge')
    c.timeMs = 10
    expect(updateFrame(c, input(), DT)).toContain('die')
  })
})
