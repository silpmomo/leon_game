import { beforeEach, describe, expect, it } from 'vitest'
import {
  canStomp,
  hitBlock,
  hurtPlayer,
  resolveBalls,
  resolveCoins,
  resolveEnemies,
  resolveItems,
} from '../src/game/rules'
import { SCORE } from '../src/game/score'
import { parseTiles, tileAt } from '../src/world/tilemap'
import { createPlayer, resizePlayer } from '../src/world/player'
import { createBall, createEnemy, createItem } from '../src/world/entities'
import { TUNING } from '../src/engine/tuning'
import type { EnemyKind, GameState, LevelData } from '../src/types'

const ROWS = ['..........', '..B?@*H...', '..........', '##########']

const LEVEL: LevelData = {
  name: 'test',
  id: 'test',
  theme: 'day',
  width: 10,
  height: 4,
  spawn: { x: 1, y: 2 },
  goal: { x: 9, flagTop: 0 },
  tiles: ROWS,
  entities: [],
  checkpoints: [],
}

function makeState(): GameState {
  const { grid, coins } = parseTiles(ROWS)
  return {
    scene: 'playing',
    mode: 'challenge',
    level: LEVEL,
    grid,
    player: createPlayer(1, 2),
    enemies: [],
    coins,
    items: [],
    balls: [],
    platforms: [],
    bumps: [],
    camera: { x: 0, y: 0 },
    coinCount: 0,
    score: 0,
    lives: 3,
    timeMs: 400_000,
    deaths: 0,
    combo: 0,
    checkpointX: 1,
    sceneMs: 0,
    muted: false,
  }
}

let s: GameState
beforeEach(() => {
  s = makeState()
})

/** 적을 플레이어와 겹치게 놓는다. above=true면 플레이어가 위에서 내려오는 상황 */
function placeOn(kind: EnemyKind, above: boolean) {
  const e = createEnemy(kind, 1, 2, -1)
  e.active = true
  e.x = s.player.x
  if (above) {
    s.player.y = e.y - s.player.h + 2
    s.player.vy = 100
    s.player.onGround = false
  } else {
    s.player.y = e.y + e.h - s.player.h
    s.player.vy = 0
  }
  s.enemies.push(e)
  return e
}

describe('canStomp', () => {
  it('하강 중이고 발이 적 상단 근처면 성립', () => {
    const e = placeOn('broccoli', true)
    expect(canStomp(s.player, e)).toBe(true)
  })

  it('상승 중에는 성립하지 않는다', () => {
    const e = placeOn('broccoli', true)
    s.player.vy = -100
    expect(canStomp(s.player, e)).toBe(false)
  })

  it('발이 적 상단보다 많이 아래면 성립하지 않는다', () => {
    const e = placeOn('broccoli', false)
    s.player.vy = 100
    expect(canStomp(s.player, e)).toBe(false)
  })

  it('여유 4px 안이면 성립한다 (관대화)', () => {
    const e = placeOn('broccoli', true)
    s.player.y = e.y - s.player.h + TUNING.stompGrace - 1
    s.player.vy = 50
    expect(canStomp(s.player, e)).toBe(true)
  })

  it('악어는 위에서 내려와도 성립하지 않는다', () => {
    const e = placeOn('crocodile', true)
    expect(canStomp(s.player, e)).toBe(false)
  })

  it('미역국은 성립한다', () => {
    const e = placeOn('soup', true)
    expect(canStomp(s.player, e)).toBe(true)
  })
})

describe('resolveEnemies — 밟기', () => {
  it('브로콜리를 밟으면 납작해지고 튕긴다', () => {
    placeOn('broccoli', true)
    const events = resolveEnemies(s)
    expect(events).toContain('stomp')
    expect(s.enemies[0]!.squashMs).toBeGreaterThan(0)
    expect(s.player.vy).toBe(TUNING.stompBounce)
  })

  it('점프 버튼을 누른 상태로 밟으면 더 높이 튕긴다', () => {
    placeOn('broccoli', true)
    resolveEnemies(s, true)
    expect(s.player.vy).toBe(TUNING.stompBounceHeld)
  })

  it('연속 밟기로 콤보 점수가 오른다', () => {
    placeOn('broccoli', true)
    resolveEnemies(s)
    expect(s.score).toBe(100)
    expect(s.combo).toBe(1)
    s.enemies = []
    placeOn('broccoli', true)
    resolveEnemies(s)
    expect(s.score).toBe(100 + 200)
  })

  it('땅에 붙은 상태에서 밟으면 콤보가 처음부터 시작한다', () => {
    s.combo = 3
    placeOn('broccoli', true)
    s.player.onGround = true
    resolveEnemies(s)
    expect(s.combo).toBe(1)
  })

  it('미역국도 밟을 수 있다', () => {
    placeOn('soup', true)
    expect(resolveEnemies(s)).toContain('stomp')
  })

  it('비활성 적은 판정하지 않는다', () => {
    const e = placeOn('broccoli', true)
    e.active = false
    expect(resolveEnemies(s)).toEqual([])
  })
})

describe('resolveEnemies — 피격', () => {
  it('옆에서 닿으면 큰 상태가 작아지고 무적이 걸린다', () => {
    s.player.power = 'big'
    placeOn('broccoli', false)
    const events = resolveEnemies(s)
    expect(events).toContain('hurt')
    expect(s.player.power).toBe('small')
    expect(s.player.invulnMs).toBe(TUNING.invulnMs)
  })

  it('ball 상태는 big으로 한 단계만 내려간다', () => {
    s.player.power = 'ball'
    placeOn('broccoli', false)
    resolveEnemies(s)
    expect(s.player.power).toBe('big')
  })

  it('작은 상태에서 닿으면 죽는다', () => {
    placeOn('broccoli', false)
    expect(resolveEnemies(s)).toContain('die')
    expect(s.deaths).toBe(1)
  })

  it('무적 중에는 접촉이 무시된다', () => {
    s.player.invulnMs = 500
    s.player.power = 'big'
    placeOn('broccoli', false)
    expect(resolveEnemies(s)).toEqual([])
    expect(s.player.power).toBe('big')
  })

  it('악어를 위에서 눌러도 피격이다', () => {
    s.player.power = 'big'
    placeOn('crocodile', true)
    expect(resolveEnemies(s)).toContain('hurt')
  })

  it('납작해진 적은 더 이상 접촉 판정하지 않는다', () => {
    const e = placeOn('broccoli', false)
    e.squashMs = 100
    expect(resolveEnemies(s)).toEqual([])
  })

  it('한 프레임에 두 번 다치지 않는다', () => {
    s.player.power = 'ball'
    placeOn('broccoli', false)
    const e2 = createEnemy('broccoli', 1, 2, -1)
    e2.active = true
    e2.x = s.player.x
    e2.y = s.player.y
    s.enemies.push(e2)
    const events = resolveEnemies(s)
    expect(events.filter((e) => e === 'hurt')).toHaveLength(1)
    expect(s.player.power).toBe('big')
  })
})

describe('resolveCoins', () => {
  it('코인을 먹으면 점수와 개수가 오른다', () => {
    s.coins.push({ x: s.player.x, y: s.player.y, w: 10, h: 14, taken: false })
    expect(resolveCoins(s)).toContain('coin')
    expect(s.coinCount).toBe(1)
    expect(s.score).toBe(SCORE.coin)
  })

  it('같은 코인을 두 번 먹지 않는다', () => {
    s.coins.push({ x: s.player.x, y: s.player.y, w: 10, h: 14, taken: false })
    resolveCoins(s)
    expect(resolveCoins(s)).toEqual([])
    expect(s.coinCount).toBe(1)
  })

  it('100개를 채우면 목숨이 늘고 카운터가 돈다', () => {
    s.coinCount = 99
    s.coins.push({ x: s.player.x, y: s.player.y, w: 10, h: 14, taken: false })
    const events = resolveCoins(s)
    expect(events).toContain('extraLife')
    expect(s.lives).toBe(4)
    expect(s.coinCount).toBe(0)
  })

  it('멀리 있는 코인은 먹지 않는다', () => {
    s.coins.push({ x: 500, y: 500, w: 10, h: 14, taken: false })
    expect(resolveCoins(s)).toEqual([])
  })
})

describe('resolveItems', () => {
  function placeItem(kind: 'peach' | 'ball') {
    const it = createItem(kind, 1, 2, 1)
    it.x = s.player.x
    it.y = s.player.y
    s.items.push(it)
    return it
  }

  it('복숭아를 먹으면 small이 big이 된다', () => {
    placeItem('peach')
    expect(resolveItems(s)).toContain('powerup')
    expect(s.player.power).toBe('big')
  })

  it('big이 복숭아를 먹어도 big에 머문다', () => {
    s.player.power = 'big'
    placeItem('peach')
    resolveItems(s)
    expect(s.player.power).toBe('big')
  })

  it('big이 축구공을 먹으면 ball이 된다', () => {
    s.player.power = 'big'
    placeItem('ball')
    resolveItems(s)
    expect(s.player.power).toBe('ball')
  })

  it('small이 축구공을 먹으면 big까지만 오른다', () => {
    placeItem('ball')
    resolveItems(s)
    expect(s.player.power).toBe('big')
  })

  it('먹은 아이템은 다시 먹히지 않는다', () => {
    placeItem('peach')
    resolveItems(s)
    expect(resolveItems(s)).toEqual([])
  })
})

describe('hitBlock', () => {
  it('? 블록을 치면 사용됨으로 바뀌고 코인이 들어온다', () => {
    const events = hitBlock(s, 3, 1) // '?'
    expect(events).toContain('coin')
    expect(tileAt(s.grid, 3, 1)).toBe('H')
    expect(s.coinCount).toBe(1)
  })

  it('@ 블록은 복숭아를 내놓는다', () => {
    hitBlock(s, 4, 1)
    expect(s.items).toHaveLength(1)
    expect(s.items[0]!.kind).toBe('peach')
  })

  it('* 블록은 축구공을 내놓는다', () => {
    hitBlock(s, 5, 1)
    expect(s.items[0]!.kind).toBe('ball')
  })

  it('사용된 ? 블록은 두 번 나오지 않는다', () => {
    hitBlock(s, 4, 1)
    const events = hitBlock(s, 4, 1)
    expect(s.items).toHaveLength(1)
    expect(events).toContain('bump')
  })

  it('작은 상태로 벽돌을 치면 튕기기만 한다', () => {
    const events = hitBlock(s, 2, 1)
    expect(events).toContain('bump')
    expect(tileAt(s.grid, 2, 1)).toBe('B')
  })

  it('큰 상태로 벽돌을 치면 부서진다', () => {
    s.player.power = 'big'
    const events = hitBlock(s, 2, 1)
    expect(events).toContain('brick')
    expect(tileAt(s.grid, 2, 1)).toBe('.')
  })

  it('단단블록은 항상 튕기기만 한다', () => {
    s.player.power = 'big'
    expect(hitBlock(s, 6, 1)).toEqual(['bump'])
  })

  it('블록 위의 적은 뒤집혀 제거된다', () => {
    const e = createEnemy('broccoli', 3, 0, -1)
    e.active = true
    s.enemies.push(e)
    hitBlock(s, 3, 1)
    expect(s.enemies[0]!.squashMs).toBeGreaterThan(0)
  })

  it('블록 위에 없는 적은 건드리지 않는다', () => {
    const e = createEnemy('broccoli', 9, 2, -1)
    e.active = true
    s.enemies.push(e)
    hitBlock(s, 3, 1)
    expect(s.enemies[0]!.squashMs).toBe(0)
  })

  it('bump 애니메이션 항목이 쌓인다', () => {
    hitBlock(s, 2, 1)
    expect(s.bumps).toHaveLength(1)
    expect(s.bumps[0]).toMatchObject({ tx: 2, ty: 1 })
  })
})

describe('resolveBalls', () => {
  function shoot(atX: number, atY: number) {
    const b = createBall(s.player)
    b.x = atX
    b.y = atY
    s.balls.push(b)
    return b
  }

  it('축구공이 브로콜리에 닿으면 즉시 제거한다', () => {
    const e = createEnemy('broccoli', 4, 2, -1)
    e.active = true
    s.enemies.push(e)
    shoot(e.x, e.y)
    resolveBalls(s)
    expect(s.enemies[0]!.alive).toBe(false)
    expect(s.balls[0]!.alive).toBe(false)
  })

  it('악어는 두 발을 맞아야 죽는다', () => {
    const e = createEnemy('crocodile', 4, 2, -1)
    e.active = true
    s.enemies.push(e)
    for (let i = 0; i < 2; i++) {
      shoot(e.x, e.y)
      resolveBalls(s)
    }
    expect(s.enemies[0]!.alive).toBe(false)
  })

  it('한 발만 맞으면 살아 있다', () => {
    const e = createEnemy('crocodile', 4, 2, -1)
    e.active = true
    s.enemies.push(e)
    shoot(e.x, e.y)
    resolveBalls(s)
    expect(s.enemies[0]!.alive).toBe(true)
    expect(s.enemies[0]!.hp).toBe(1)
  })

  it('공 하나가 적 둘을 뚫지 않는다', () => {
    for (const tx of [4, 4]) {
      const e = createEnemy('broccoli', tx, 2, -1)
      e.active = true
      s.enemies.push(e)
    }
    shoot(s.enemies[0]!.x, s.enemies[0]!.y)
    resolveBalls(s)
    expect(s.enemies.filter((e) => e.alive)).toHaveLength(1)
  })

  it('빗나간 공은 아무것도 죽이지 않는다', () => {
    const e = createEnemy('broccoli', 4, 2, -1)
    e.active = true
    s.enemies.push(e)
    shoot(500, 500)
    resolveBalls(s)
    expect(s.enemies[0]!.alive).toBe(true)
  })
})

describe('hurtPlayer', () => {
  it('작은 상태면 죽고 죽은 횟수가 오른다', () => {
    expect(hurtPlayer(s)).toContain('die')
    expect(s.deaths).toBe(1)
  })

  it('무적 중에는 아무 일도 없다', () => {
    s.player.invulnMs = 100
    expect(hurtPlayer(s)).toEqual([])
  })

  it('피격 후 크기가 실제로 줄어든다', () => {
    // power를 직접 대입하면 크기가 동기화되지 않는다. resizePlayer를 거쳐야 한다.
    resizePlayer(s.player, 'big')
    const h0 = s.player.h
    hurtPlayer(s)
    expect(s.player.power).toBe('small')
    expect(s.player.h).toBeLessThan(h0)
  })

  it('피격 후에도 발밑 위치가 유지된다 (땅에 박히지 않는다)', () => {
    resizePlayer(s.player, 'big')
    const feet = s.player.y + s.player.h
    hurtPlayer(s)
    expect(s.player.y + s.player.h).toBe(feet)
  })
})
