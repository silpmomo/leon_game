import { beforeEach, describe, expect, it } from 'vitest'
import { newGameState, updateFrame } from '../src/game/update'
import { resolveBolts } from '../src/game/rules'
import { createBolt, createEnemy, updateBolt } from '../src/world/entities'
import { resizePlayer } from '../src/world/player'
import { buttonRects } from '../src/ui/controls'
import { parseTiles, tileAt } from '../src/world/tilemap'
import { TILE, TUNING } from '../src/engine/tuning'
import { STAGES } from '../src/levels/index'
import { SFX } from '../src/core/audio'
import { AMP, SEGS, boltPath, wobble } from '../src/render/bolt'
import { EMPTY_INPUT, type GameState, type InputState, type LevelData } from '../src/types'

const DT = 1 / 60
const input = (o: Partial<InputState> = {}): InputState => ({ ...EMPTY_INPUT, ...o })

const OPEN = [
  '..............................',
  '..............................',
  '..............................',
  '..............................',
  '..............................',
  '..............................',
  '..............................',
  '..............................',
  '..............................',
  '..............................',
  '##############################',
  '##############################',
]

function level(tiles: string[] = OPEN, over: Partial<LevelData> = {}): LevelData {
  return {
    name: 't',
    id: 't',
    theme: 'day',
    width: tiles[0]!.length,
    height: tiles.length,
    spawn: { x: 2, y: 9 },
    goal: { x: tiles[0]!.length - 2, flagTop: 2 },
    tiles,
    entities: [],
    checkpoints: [],
    ...over,
  }
}

function armed(lv: LevelData = level()): GameState {
  const s = newGameState(lv, 'practice')
  resizePlayer(s.player, 'bolt')
  for (let i = 0; i < 30; i++) updateFrame(s, input(), DT)
  return s
}

describe('전기 파워업', () => {
  it('E 블록을 치면 전기 아이템이 나온다', () => {
    const tiles = [...OPEN]
    tiles[6] = '.....E' + '.'.repeat(24)
    const s = newGameState(level(tiles), 'practice')
    s.player.x = 5 * TILE + 2
    for (let i = 0; i < 30; i++) updateFrame(s, input(), DT)

    let got = false
    for (let i = 0; i < 90 && !got; i++) {
      const ev = updateFrame(s, input({ jump: true, jumpPressed: i === 0 }), DT)
      if (ev.includes('powerup')) got = true
    }
    expect(got).toBe(true)
    expect(s.items.some((it) => it.kind === 'bolt')).toBe(true)
    expect(tileAt(s.grid, 5, 6)).toBe('H')
  })

  it('작은 상태로 먹으면 먼저 커지기만 한다', () => {
    const s = newGameState(level(), 'practice')
    for (let i = 0; i < 30; i++) updateFrame(s, input(), DT)
    s.items.push({
      x: s.player.x, y: s.player.y, vx: 0, vy: 0, w: 14, h: 14,
      onGround: false, kind: 'bolt', taken: false,
    })
    updateFrame(s, input(), DT)
    expect(s.player.power).toBe('big')
  })

  it('큰 상태로 먹으면 전기를 든다', () => {
    const s = newGameState(level(), 'practice')
    resizePlayer(s.player, 'big')
    for (let i = 0; i < 30; i++) updateFrame(s, input(), DT)
    s.items.push({
      x: s.player.x, y: s.player.y, vx: 0, vy: 0, w: 14, h: 14,
      onGround: false, kind: 'bolt', taken: false,
    })
    updateFrame(s, input(), DT)
    expect(s.player.power).toBe('bolt')
  })

  it('피격하면 축구공과 같은 등급에서 big 으로 내려간다', () => {
    const s = armed()
    const e = createEnemy('broccoli', 4, 9, -1)
    e.active = true
    e.x = s.player.x
    e.y = s.player.y + s.player.h - e.h
    s.enemies.push(e)
    const ev = updateFrame(s, input(), DT)
    expect(ev).toContain('hurt')
    expect(s.player.power).toBe('big')
  })

  it('전기를 들면 발사 버튼이 나타난다', () => {
    expect(buttonRects('bolt').fire).not.toBeNull()
    expect(buttonRects('big').fire).toBeNull()
  })
})

describe('전기 빔 발사', () => {
  let s: GameState
  beforeEach(() => {
    s = armed()
  })

  it('발사 입력에 빔이 생기고 bolt 이벤트가 나온다', () => {
    const ev = updateFrame(s, input({ firePressed: true }), DT)
    expect(ev).toContain('bolt')
    expect(s.bolts).toHaveLength(1)
  })

  it('화면 번쩍임이 켜진다', () => {
    updateFrame(s, input({ firePressed: true }), DT)
    expect(s.flashMs).toBeGreaterThan(0)
  })

  it('쿨다운 중에는 다시 발사되지 않는다', () => {
    updateFrame(s, input({ firePressed: true }), DT)
    expect(s.bolts).toHaveLength(1)
    updateFrame(s, input({ firePressed: true }), DT)
    expect(s.bolts).toHaveLength(1)
    expect(s.boltCooldownMs).toBeGreaterThan(0)
  })

  it('쿨다운이 끝나면 다시 발사된다', () => {
    updateFrame(s, input({ firePressed: true }), DT)
    const frames = Math.ceil(TUNING.boltCooldownMs / (DT * 1000)) + 2
    for (let i = 0; i < frames; i++) updateFrame(s, input(), DT)
    expect(s.boltCooldownMs).toBe(0)
    updateFrame(s, input({ firePressed: true }), DT)
    expect(s.bolts.length).toBeGreaterThanOrEqual(1)
  })

  it('빔은 짧게 살아 있다가 사라진다', () => {
    updateFrame(s, input({ firePressed: true }), DT)
    const frames = Math.ceil(TUNING.boltMs / (DT * 1000)) + 2
    for (let i = 0; i < frames; i++) updateFrame(s, input(), DT)
    expect(s.bolts).toHaveLength(0)
  })

  it('축구공을 든 상태에서는 빔이 아니라 공이 나간다', () => {
    const b = armed()
    resizePlayer(b.player, 'ball')
    const ev = updateFrame(b, input({ firePressed: true }), DT)
    expect(ev).toContain('fire')
    expect(b.bolts).toHaveLength(0)
    expect(b.balls).toHaveLength(1)
  })

  it('무기가 없으면 아무것도 발사되지 않는다', () => {
    const n = newGameState(level(), 'practice')
    for (let i = 0; i < 30; i++) updateFrame(n, input(), DT)
    updateFrame(n, input({ firePressed: true }), DT)
    expect(n.bolts).toHaveLength(0)
    expect(n.balls).toHaveLength(0)
  })
})

describe('전기 빔 사거리', () => {
  it('보는 방향으로 뻗는다', () => {
    const s = armed()
    s.player.facing = 1
    const right = createBolt(s.player, s.grid)
    expect(right.x).toBeGreaterThanOrEqual(s.player.x)
    expect(right.dir).toBe(1)

    s.player.facing = -1
    const left = createBolt(s.player, s.grid)
    expect(left.x + left.w).toBeLessThanOrEqual(s.player.x + 1)
    expect(left.dir).toBe(-1)
  })

  it('막는 것이 없으면 최대 사거리까지 뻗는다', () => {
    const s = armed()
    s.player.facing = 1
    expect(createBolt(s.player, s.grid).w).toBe(TUNING.boltLenTiles * TILE)
  })

  it('벽에 막히면 거기서 끊긴다 (벽 너머를 때리지 못한다)', () => {
    const tiles = [...OPEN]
    // 플레이어 눈높이에 벽을 세운다
    for (const r of [8, 9]) {
      tiles[r] = '.'.repeat(8) + '#' + '.'.repeat(21)
    }
    const s = armed(level(tiles))
    s.player.x = 4 * TILE
    s.player.facing = 1
    const b = createBolt(s.player, s.grid)
    expect(b.w).toBeLessThan(TUNING.boltLenTiles * TILE)
    expect(b.x + b.w).toBeLessThanOrEqual(8 * TILE + 4)
  })

  it('최소 한 타일은 나간다', () => {
    const s = armed()
    s.player.facing = 1
    expect(createBolt(s.player, s.grid).w).toBeGreaterThanOrEqual(TILE)
  })
})

describe('전기 빔 피해', () => {
  function withEnemies(kinds: ('broccoli' | 'crocodile' | 'flyer' | 'boss')[]): GameState {
    const s = armed()
    // 사거리는 플레이어(타일 4) 앞 7타일 = 타일 11 근처까지다.
    // 그 밖에 두면 관통 테스트가 사거리 문제로 실패한다.
    kinds.forEach((k, i) => {
      const e = createEnemy(k, 6 + i * 2, 9, -1)
      e.active = true
      e.y = s.player.y
      s.enemies.push(e)
    })
    s.player.x = 4 * TILE
    s.player.facing = 1
    return s
  }

  it('브로콜리를 한 방에 없앤다', () => {
    const s = withEnemies(['broccoli'])
    s.bolts.push(createBolt(s.player, s.grid))
    resolveBolts(s)
    expect(s.enemies[0]!.alive).toBe(false)
  })

  it('악어(hp 2)도 한 방에 없앤다 — 축구공은 두 발이 필요하다', () => {
    const s = withEnemies(['crocodile'])
    s.bolts.push(createBolt(s.player, s.grid))
    resolveBolts(s)
    expect(s.enemies[0]!.alive).toBe(false)
    expect(TUNING.boltDamage).toBe(2)
  })

  it('일직선상의 여러 적을 한 번에 관통한다', () => {
    const s = withEnemies(['broccoli', 'broccoli', 'broccoli'])
    s.bolts.push(createBolt(s.player, s.grid))
    resolveBolts(s)
    expect(s.enemies.every((e) => !e.alive)).toBe(true)
  })

  it('같은 적을 프레임마다 다시 때리지 않는다', () => {
    const s = withEnemies(['boss'])
    const boss = s.enemies[0]!
    const b = createBolt(s.player, s.grid)
    s.bolts.push(b)
    resolveBolts(s)
    const hp1 = boss.hp
    resolveBolts(s)
    expect(boss.hp).toBe(hp1)
    expect(b.hit).toHaveLength(1)
  })

  it('보스는 3방에 쓰러진다 (hp 5, 한 방 2피해)', () => {
    const s = withEnemies(['boss'])
    const boss = s.enemies[0]!
    let shots = 0
    while (boss.alive && shots < 10) {
      const b = createBolt(s.player, s.grid)
      s.bolts.push(b)
      resolveBolts(s)
      shots += 1
    }
    expect(shots).toBe(3)
    expect(boss.alive).toBe(false)
  })

  it('빔이 만료되면 더 이상 때리지 않는다', () => {
    const s = withEnemies(['broccoli'])
    const b = createBolt(s.player, s.grid)
    b.ms = 0
    s.bolts.push(b)
    resolveBolts(s)
    expect(s.enemies[0]!.alive).toBe(true)
  })

  it('비활성 적은 때리지 않는다', () => {
    const s = withEnemies(['broccoli'])
    s.enemies[0]!.active = false
    s.bolts.push(createBolt(s.player, s.grid))
    resolveBolts(s)
    expect(s.enemies[0]!.alive).toBe(true)
  })
})

describe('빔 수명', () => {
  it('updateBolt 가 남은 시간을 깎는다', () => {
    const s = armed()
    const b = createBolt(s.player, s.grid)
    const before = b.ms
    updateBolt(b, DT)
    expect(b.ms).toBeLessThan(before)
  })
})

describe('전기 배치', () => {
  const boltBlocks = (lv: (typeof STAGES)[number]): number =>
    lv.tiles.reduce((a, r) => a + (r.match(/E/g)?.length ?? 0), 0)

  it('1-6 부터 1-10 까지 전기 블록이 하나씩 있다', () => {
    for (const lv of STAGES.slice(5, 10)) {
      expect(boltBlocks(lv), `${lv.name} 에 전기 블록이 없다`).toBeGreaterThan(0)
    }
  })

  it('1-1 부터 1-5 에는 전기가 없다 (뒤에서 처음 나온다)', () => {
    for (const lv of STAGES.slice(0, 5)) {
      expect(boltBlocks(lv), `${lv.name} 에 전기가 너무 일찍 나온다`).toBe(0)
    }
  })

  it('2월드에도 전기가 나온다', () => {
    const withBolt = STAGES.slice(10).filter((lv) => boltBlocks(lv) > 0)
    expect(withBolt.length).toBeGreaterThan(0)
  })

  it('E 블록은 solid 다 (밟고 설 수 있고 아래에서 칠 수 있다)', () => {
    const { grid } = parseTiles(['....', '.E..', '####'])
    expect(tileAt(grid, 1, 1)).toBe('E')
  })
})

describe('전기 효과음', () => {
  it('노이즈와 톤 두 갈래가 있다', () => {
    expect(SFX.bolt!.wave).toBe('noise')
    expect(SFX.boltTone!.wave).toBe('sawtooth')
  })

  it('톤은 위에서 아래로 떨어진다', () => {
    const n = SFX.boltTone!.notes
    expect(n[n.length - 1]!).toBeLessThan(n[0]!)
  })

  it('비브라토가 걸려 지지직거린다', () => {
    expect(SFX.boltTone!.vibrato).toBeGreaterThan(0)
  })
})

describe('번개 경로 (렌더 로직)', () => {
  const beam = (dir: 1 | -1) => ({
    x: 100, y: 50, vx: 0, vy: 0, w: 112, h: 10,
    onGround: false, dir, ms: 150, totalMs: 150, hit: [],
  })

  it('시작점과 끝점이 빔 양 끝에 붙는다', () => {
    const p = boltPath(beam(1), SEGS, AMP, 0)
    expect(p[0]!.x).toBe(100)
    expect(p[p.length - 1]!.x).toBe(212)
  })

  it('왼쪽을 보면 방향이 뒤집힌다', () => {
    const p = boltPath(beam(-1), SEGS, AMP, 0)
    expect(p[0]!.x).toBe(212)
    expect(p[p.length - 1]!.x).toBe(100)
  })

  it('양 끝은 빔 중심선에 붙는다 (손과 끝에서 좁혀진다)', () => {
    const p = boltPath(beam(1), SEGS, AMP, 0)
    const cy = 50 + 10 / 2
    expect(Math.abs(p[0]!.y - cy)).toBeLessThan(0.01)
    expect(Math.abs(p[p.length - 1]!.y - cy)).toBeLessThan(0.01)
  })

  it('위아래를 번갈아 꺾는다 (물결이 아니라 지그재그)', () => {
    const p = boltPath(beam(1), SEGS, AMP, 0)
    const cy = 55
    // 양 끝은 중심에 붙으므로 가운데 구간만 본다
    const mid = p.slice(1, -1)
    for (let i = 1; i < mid.length; i++) {
      const a = mid[i - 1]!.y - cy
      const b = mid[i]!.y - cy
      expect(Math.sign(a) * Math.sign(b), `${i}번째가 같은 쪽`).toBe(-1)
    }
  })

  it('진폭을 넘지 않는다', () => {
    const p = boltPath(beam(1), SEGS, AMP, 3.3)
    for (const pt of p) expect(Math.abs(pt.y - 55)).toBeLessThanOrEqual(AMP + 0.01)
  })

  it('x가 단조 증가한다 (경로가 되돌아가지 않는다)', () => {
    const p = boltPath(beam(1), SEGS, AMP, 7)
    for (let i = 1; i < p.length; i++) {
      expect(p[i]!.x).toBeGreaterThanOrEqual(p[i - 1]!.x)
    }
  })

  it('결정적이다 — 같은 입력이면 같은 경로 (골든 리플레이가 깨지지 않는다)', () => {
    expect(boltPath(beam(1), SEGS, AMP, 4.2)).toEqual(boltPath(beam(1), SEGS, AMP, 4.2))
  })

  it('위상이 바뀌면 모양이 바뀐다 (애니메이션이 실제로 흔들린다)', () => {
    expect(boltPath(beam(1), SEGS, AMP, 0)).not.toEqual(boltPath(beam(1), SEGS, AMP, 9))
  })

  it('세그먼트가 적어 긴 직선 구간이 생긴다', () => {
    // 18개로 잡았을 때는 6px마다 꺾여 스프링처럼 보였다
    expect(SEGS).toBeLessThanOrEqual(9)
    const p = boltPath(beam(1), SEGS, AMP, 0)
    const avgLen = 112 / SEGS
    expect(avgLen).toBeGreaterThan(10)
    expect(p).toHaveLength(SEGS + 1)
  })

  it('wobble 은 -1~1 범위다', () => {
    for (let i = 0; i < 200; i++) {
      const v = wobble(i * 1.7)
      expect(v).toBeGreaterThanOrEqual(-1)
      expect(v).toBeLessThanOrEqual(1)
    }
  })
})
