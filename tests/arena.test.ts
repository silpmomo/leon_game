import { describe, expect, it } from 'vitest'
import type { ArenaMap, ArenaState } from '../src/arena/types'
import { NO_INPUT } from '../src/arena/types'
import { ARENA_MAPS } from '../src/arena/maps'
import { arenaMapProblems, assertValidArenaMaps } from '../src/arena/schema'
import {
  blocksMove, blocksShot, clearShot, mirrorRows, moveBox, nextStep, parseMap, tileAt,
} from '../src/arena/grid'
import {
  MAX_AMMO, autoAim, canSee, fire, fireSuper, gasProgress, hurt, inGas,
  pickGems, safeRect, tickFighter, updateBullets,
} from '../src/arena/combat'
import { newArenaState, pickSpawns, updateArena } from '../src/arena/update'
import { advanceArenaScene, arenaToRecord, playerRank } from '../src/arena/scenes'
import {
  BASE_HP, BUSH_SEE_PX, CRATE_HP, GAS_DELAY_S, GAS_SHRINK_S, GEM_HP, HEAL_DELAY_MS,
  MAP_H, MAP_W, TILE, WEAPONS, WORLD_H, WORLD_W,
} from '../src/arena/tuning'
import { EMPTY_RECORD } from '../src/storage'

const DT = 1 / 60

/** 빈 풀밭 4분면에 원하는 칸만 찍은 시험용 맵 */
function testMap(marks: Record<string, string> = {}, bots = 1): ArenaMap {
  const rows = Array.from({ length: MAP_H / 2 }, () => Array(MAP_W / 2).fill('.'))
  rows[1]![1] = 'S'
  rows[1]![20] = 'S'
  for (const [k, ch] of Object.entries(marks)) {
    const [x, y] = k.split(',').map(Number)
    rows[y!]![x!] = ch
  }
  return {
    id: 't', name: '시험', theme: 'meadow', bots, weapons: ['bolt'],
    difficulty: { aimError: 0, thinkMs: 300, aggro: 100, fleeAt: 0.3 },
    quadrant: rows.map((r) => r.join('')),
  }
}

/** 리온(0)과 봇(1)을 원하는 자리에 놓고 바로 playing */
function duel(map = testMap()): ArenaState {
  const s = newArenaState(map, 'challenge', 3)
  s.scene = 'playing'
  return s
}

function place(s: ArenaState, id: number, tx: number, ty: number): void {
  const f = s.fighters[id]!
  f.x = (tx + 0.5) * TILE
  f.y = (ty + 0.5) * TILE
}

describe('숲속대결 맵', () => {
  it('6판 모두 검증을 통과한다', () => {
    for (const m of ARENA_MAPS) expect(arenaMapProblems(m), m.id).toEqual([])
    expect(() => assertValidArenaMaps(ARENA_MAPS)).not.toThrow()
  })

  it('판이 갈수록 친구가 늘거나 같다', () => {
    for (let i = 1; i < ARENA_MAPS.length; i++) {
      expect(ARENA_MAPS[i]!.bots).toBeGreaterThanOrEqual(ARENA_MAPS[i - 1]!.bots)
    }
  })

  it('판이 갈수록 봇 조준이 정확해진다', () => {
    for (let i = 1; i < ARENA_MAPS.length; i++) {
      expect(ARENA_MAPS[i]!.difficulty.aimError)
        .toBeLessThan(ARENA_MAPS[i - 1]!.difficulty.aimError)
    }
  })

  it('거울 복사로 48×32 가 되고 좌우·상하 대칭이다', () => {
    const rows = mirrorRows(ARENA_MAPS[2]!.quadrant)
    expect(rows.length).toBe(MAP_H)
    for (const r of rows) {
      expect(r.length).toBe(MAP_W)
      expect(r).toBe([...r].reverse().join(''))
    }
    expect(rows[0]).toBe(rows[MAP_H - 1])
  })

  it('잘못된 맵은 원인을 알려준다', () => {
    const bad = { ...testMap(), quadrant: ['...'] }
    expect(arenaMapProblems(bad).length).toBeGreaterThan(0)
    const walled = testMap({ '0,0': '#' })
    // 시작점을 벽으로 둘러싸 고립시킨다
    const m = testMap({ '0,1': '#', '2,1': '#', '1,0': '#', '1,2': '#' })
    expect(arenaMapProblems(walled)).toEqual([])
    expect(arenaMapProblems(m).join()).toContain('고립')
  })

  it('시작점은 서로 먼 자리부터 고른다', () => {
    const sp: [number, number][] = [[0, 0], [1, 0], [100, 100], [50, 50]]
    const got = pickSpawns(sp, 2, 0)
    expect(got[1]).toEqual([100, 100])
  })

  it('참가자 수만큼 다른 자리에서 시작한다', () => {
    for (const m of ARENA_MAPS) {
      const s = newArenaState(m, 'practice', 11)
      expect(s.fighters.length).toBe(m.bots + 1)
      const keys = new Set(s.fighters.map((f) => `${f.x},${f.y}`))
      expect(keys.size, m.id).toBe(s.fighters.length)
      expect(s.fighters[0]!.isPlayer).toBe(true)
    }
  })
})

describe('지형', () => {
  it('바위·물·상자는 못 지나가고 수풀·풀은 지나간다', () => {
    expect(blocksMove('#')).toBe(true)
    expect(blocksMove('w')).toBe(true)
    expect(blocksMove('x')).toBe(true)
    expect(blocksMove('"')).toBe(false)
    expect(blocksMove('.')).toBe(false)
    expect(blocksMove(null)).toBe(true)
  })

  it('물은 탄이 넘어가고 바위는 막는다', () => {
    expect(blocksShot('w')).toBe(false)
    expect(blocksShot('#')).toBe(true)
  })

  it('벽으로 걸어가면 멈춘다', () => {
    const { grid } = parseMap(testMap({ '5,5': '#' }))
    let x = 3.5 * TILE
    const y = 5.5 * TILE
    for (let i = 0; i < 100; i++) [x] = moveBox(grid, x, y, 1, 0)
    expect(x).toBeLessThanOrEqual(5 * TILE - 5 + 0.01)
  })

  it('맵 밖으로 못 나간다', () => {
    const { grid } = parseMap(testMap())
    let [x, y] = [6, 6]
    for (let i = 0; i < 50; i++) [x, y] = moveBox(grid, x, y, -1, -1)
    expect(x).toBeGreaterThanOrEqual(5)
    expect(y).toBeGreaterThanOrEqual(5)
  })

  it('길찾기는 벽을 돌아간다', () => {
    // 세로 벽 (x=5, y=0..8) 너머로 간다
    const marks: Record<string, string> = {}
    for (let y = 0; y <= 8; y++) marks[`5,${y}`] = '#'
    const { grid } = parseMap(testMap(marks))
    let x = 2.5 * TILE
    let y = 2.5 * TILE
    const gx = 8.5 * TILE
    const gy = 2.5 * TILE
    for (let i = 0; i < 60; i++) {
      const st = nextStep(grid, x, y, gx, gy)
      expect(st).not.toBeNull()
      ;[x, y] = st!
      if (Math.floor(x / TILE) === 8 && Math.floor(y / TILE) === 2) break
      expect(tileAt(grid, Math.floor(x / TILE), Math.floor(y / TILE))).not.toBe('#')
    }
    expect(Math.floor(x / TILE)).toBe(8)
  })

  it('사이에 바위가 있으면 쏠 수 없다', () => {
    const { grid } = parseMap(testMap({ '5,5': '#' }))
    expect(clearShot(grid, 3.5 * TILE, 5.5 * TILE, 8.5 * TILE, 5.5 * TILE)).toBe(false)
    expect(clearShot(grid, 3.5 * TILE, 3.5 * TILE, 8.5 * TILE, 3.5 * TILE)).toBe(true)
  })
})

describe('사격 · 피해', () => {
  it('탄창 3칸을 쓰면 더 못 쏘고, 시간이 지나면 다시 찬다', () => {
    const s = duel()
    const p = s.fighters[0]!
    const ev: never[] = []
    for (let i = 0; i < 5; i++) {
      p.cooldownMs = 0
      fire(s, p, 1, 0, ev)
    }
    expect(p.ammo).toBeLessThan(1)
    expect(s.bullets.length).toBe(MAX_AMMO)
    for (let i = 0; i < 60 * 4; i++) tickFighter(s, p, DT, ev)
    expect(p.ammo).toBe(MAX_AMMO)
  })

  it('산탄은 여러 갈래로 나간다', () => {
    const s = duel()
    const b = s.fighters[1]!
    b.weapon = 'spread'
    fire(s, b, 1, 0, [])
    expect(s.bullets.length).toBe(WEAPONS.spread.pellets)
  })

  it('탄이 상대를 맞히면 체력이 준다', () => {
    const s = duel()
    place(s, 0, 4, 4)
    place(s, 1, 9, 4)
    fire(s, s.fighters[0]!, 1, 0, [])
    for (let i = 0; i < 30; i++) updateBullets(s, DT, [])
    expect(s.fighters[1]!.hp).toBeCloseTo(BASE_HP - WEAPONS.bolt.dmg)
  })

  it('탄은 사거리 끝에서 사라진다', () => {
    const s = duel()
    place(s, 0, 2, 10)
    place(s, 1, 40, 25)
    fire(s, s.fighters[0]!, 1, 0, [])
    for (let i = 0; i < 120; i++) updateBullets(s, DT, [])
    expect(s.bullets.length).toBe(0)
  })

  it('쓰러지면 별을 떨구고 순위를 받는다', () => {
    const s = duel()
    const b = s.fighters[1]!
    b.gems = 3
    const ev: string[] = []
    hurt(s, b, 999, 0, ev as never)
    expect(b.alive).toBe(false)
    expect(b.rank).toBe(2)
    expect(s.gems.length).toBe(3)
    expect(s.fighters[0]!.kills).toBe(1)
    expect(ev).toContain('kill')
  })

  it('별이 없어도 1개는 떨군다', () => {
    const s = duel()
    hurt(s, s.fighters[1]!, 999, 0, [])
    expect(s.gems.length).toBe(1)
  })

  it('별을 주우면 최대 체력과 공격력이 오른다', () => {
    const s = duel()
    const p = s.fighters[0]!
    s.gems.push({ x: p.x, y: p.y, bobMs: 0 })
    pickGems(s, [])
    expect(p.gems).toBe(1)
    expect(p.maxHp).toBe(BASE_HP + GEM_HP)
    place(s, 1, Math.floor(p.x / TILE) + 4, Math.floor(p.y / TILE))
    s.fighters[1]!.y = p.y
    fire(s, p, 1, 0, [])
    expect(s.bullets[0]!.dmg).toBeCloseTo(WEAPONS.bolt.dmg * 1.1)
  })

  it('상자를 부수면 별이 나온다', () => {
    const s = duel(testMap({ '8,4': 'x' }))
    place(s, 0, 4, 4)
    const p = s.fighters[0]!
    let shots = 0
    for (let f = 0; f < 60 * 10 && tileAt(s.grid, 8, 4) === 'x'; f++) {
      p.cooldownMs = 0
      p.ammo = 3
      if (f % 20 === 0 && fire(s, p, 1, 0, [])) shots++
      updateBullets(s, DT, [])
    }
    expect(tileAt(s.grid, 8, 4)).toBe('.')
    expect(shots).toBe(Math.ceil(CRATE_HP / WEAPONS.bolt.dmg))
    expect(s.gems.length).toBe(1)
  })

  it('연습 모드에서는 봇이 리온을 약하게 때린다', () => {
    const a = newArenaState(testMap(), 'practice', 1)
    const b = newArenaState(testMap(), 'challenge', 1)
    hurt(a, a.fighters[0]!, 20, 1, [])
    hurt(b, b.fighters[0]!, 20, 1, [])
    expect(a.fighters[0]!.hp).toBeGreaterThan(b.fighters[0]!.hp)
    expect(b.fighters[0]!.hp).toBeLessThan(BASE_HP)
  })
})

describe('회복 · 필살기', () => {
  it('3초 동안 안 싸우면 회복한다', () => {
    const s = duel()
    const p = s.fighters[0]!
    hurt(s, p, 50, 1, [])
    const after = p.hp
    for (let i = 0; i < Math.floor((HEAL_DELAY_MS - 200) / 1000 * 60); i++) tickFighter(s, p, DT, [])
    expect(p.hp).toBeCloseTo(after)
    for (let i = 0; i < 60 * 3; i++) tickFighter(s, p, DT, [])
    expect(p.hp).toBeGreaterThan(after + 20)
  })

  it('맞히면 필살기 게이지가 차고, 다 차면 사방으로 쏜다', () => {
    const s = duel()
    const p = s.fighters[0]!
    expect(fireSuper(s, p, [])).toBe(false)
    hurt(s, s.fighters[1]!, 45, 0, [])
    expect(p.superCharge).toBeGreaterThan(0.4)
    p.superCharge = 1
    expect(fireSuper(s, p, [])).toBe(true)
    expect(s.bullets.length).toBe(WEAPONS.bolt.ringCount)
    expect(p.superCharge).toBe(0)
  })
})

describe('수풀', () => {
  it('수풀 속 상대는 멀면 안 보이고 가까우면 보인다', () => {
    const marks: Record<string, string> = {}
    for (let x = 10; x <= 12; x++) marks[`${x},5`] = '"'
    const s = duel(testMap(marks))
    place(s, 1, 11, 5)
    place(s, 0, 2, 5)
    expect(canSee(s, s.fighters[0]!, s.fighters[1]!)).toBe(false)
    s.fighters[0]!.x = s.fighters[1]!.x - BUSH_SEE_PX + 1
    expect(canSee(s, s.fighters[0]!, s.fighters[1]!)).toBe(true)
  })

  it('수풀에서 쏘면 잠깐 드러난다', () => {
    const s = duel(testMap({ '11,5': '"' }))
    place(s, 1, 11, 5)
    place(s, 0, 2, 5)
    fire(s, s.fighters[1]!, 1, 0, [])
    expect(canSee(s, s.fighters[0]!, s.fighters[1]!)).toBe(true)
  })

  it('자동 조준은 안 보이는 상대를 노리지 않는다', () => {
    const s = duel(testMap({ '6,5': '"' }))
    place(s, 0, 2, 5)
    place(s, 1, 6, 5)
    expect(autoAim(s, s.fighters[0]!).target).toBe('none')
    s.grid.cells[5 * s.grid.w + 6] = '.'
    expect(autoAim(s, s.fighters[0]!).target).toBe('fighter')
  })
})

describe('독안개', () => {
  it('처음에는 없다가 조여 와서 가운데만 남는다', () => {
    expect(gasProgress(GAS_DELAY_S - 1)).toBe(0)
    expect(gasProgress(GAS_DELAY_S + GAS_SHRINK_S + 10)).toBe(1)
    const r = safeRect(999)
    expect(r.x0).toBeGreaterThan(WORLD_W * 0.4)
    expect(r.x1).toBeLessThan(WORLD_W * 0.6)
    expect(inGas(999, WORLD_W / 2, WORLD_H / 2)).toBe(false)
    expect(inGas(999, 10, 10)).toBe(true)
    expect(inGas(0, 10, 10)).toBe(false)
  })

  it('안개 속에 있으면 체력이 깎이고 회복하지 못한다', () => {
    const s = duel()
    s.t = GAS_DELAY_S + GAS_SHRINK_S
    const p = s.fighters[0]!
    p.x = 8
    p.y = 8
    p.calmMs = HEAL_DELAY_MS * 2
    for (let i = 0; i < 60; i++) tickFighter(s, p, DT, [])
    expect(p.hp).toBeLessThan(BASE_HP - 15)
  })
})

describe('판 진행', () => {
  it('카운트다운이 끝나야 움직인다', () => {
    const s = newArenaState(ARENA_MAPS[0]!, 'practice', 5)
    const x = s.fighters[0]!.x
    updateArena(s, { ...NO_INPUT, mx: 1 }, DT)
    expect(s.fighters[0]!.x).toBe(x)
    for (let i = 0; i < 200; i++) advanceArenaScene(s, [], DT)
    expect(s.scene).toBe('playing')
  })

  it('마지막 1인이 되면 1등 클리어', () => {
    const s = duel()
    hurt(s, s.fighters[1]!, 999, 0, [])
    const ev = updateArena(s, NO_INPUT, DT)
    expect(ev).toContain('win')
    advanceArenaScene(s, ev, DT)
    expect(s.scene).toBe('clear')
    expect(playerRank(s)).toBe(1)
    const rec = arenaToRecord(s, { ...EMPTY_RECORD })
    expect(rec.cleared).toBe(true)
    expect(rec.bestScore).toBeGreaterThanOrEqual(1100)
  })

  it('리온이 쓰러지면 순위를 받고 결과로 간다 — 클리어는 아니다', () => {
    const s = newArenaState(ARENA_MAPS[2]!, 'challenge', 9)
    s.scene = 'playing'
    const ev: string[] = []
    hurt(s, s.fighters[0]!, 999, 1, ev as never)
    expect(ev).toContain('die')
    advanceArenaScene(s, ev as never, DT)
    expect(s.scene).toBe('dead')
    expect(playerRank(s)).toBe(s.fighters.length)
    for (let i = 0; i < 200; i++) advanceArenaScene(s, [], DT)
    expect(s.scene).toBe('gameover')
    expect(arenaToRecord(s, { ...EMPTY_RECORD }).cleared).toBe(false)
  })

  it('같은 seed 면 같은 판이 나온다', () => {
    const run = (): string => {
      const s = newArenaState(ARENA_MAPS[3]!, 'practice', 42)
      s.scene = 'playing'
      for (let i = 0; i < 60 * 15; i++) updateArena(s, NO_INPUT, DT)
      return s.fighters.map((f) => `${f.x.toFixed(2)},${f.hp.toFixed(1)}`).join('|')
    }
    expect(run()).toBe(run())
  })
})

describe('봇끼리 끝까지 돌려 보기', () => {
  /** 리온도 봇 두뇌로 돌린다. 독안개가 있으니 판은 반드시 끝나야 한다 */
  function simulate(m: ArenaMap, mode: 'practice' | 'challenge', seed: number): ArenaState {
    const s = newArenaState(m, mode, seed)
    for (let f = 0; f < 60 * 240; f++) {
      const ev = updateArena(s, NO_INPUT, DT, { autopilot: true })
      advanceArenaScene(s, ev, DT)
      if (s.scene === 'clear' || s.scene === 'gameover') break
    }
    return s
  }

  it('모든 판이 4분 안에 끝난다', () => {
    for (const m of ARENA_MAPS) {
      for (const seed of [1, 2, 3]) {
        const s = simulate(m, 'challenge', seed * 101)
        expect(['clear', 'gameover'], `${m.id} seed ${seed}`).toContain(s.scene)
      }
    }
  })

  it('연습 1판은 봇 리온도 이길 수 있다', () => {
    let wins = 0
    for (let seed = 1; seed <= 12; seed++) {
      if (simulate(ARENA_MAPS[0]!, 'practice', seed * 7919).scene === 'clear') wins++
    }
    expect(wins).toBeGreaterThanOrEqual(3)
  })

  it('순위가 겹치지 않는다', () => {
    const s = simulate(ARENA_MAPS[5]!, 'practice', 77)
    const ranks = s.fighters.filter((f) => f.rank > 0).map((f) => f.rank)
    expect(new Set(ranks).size).toBe(ranks.length)
  })
})
