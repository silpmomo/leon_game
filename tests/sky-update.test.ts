import { beforeEach, describe, expect, it } from 'vitest'
import type { SkyEvent, SkyState } from '../src/sky/types'
import { NO_INPUT, type SkyInput } from '../src/sky/player'
import { coinValue, newSkyState, respawnSky, updateSky } from '../src/sky/update'
import { advanceSkyScene, skyToRecord } from '../src/sky/scenes'
import { SKY_STAGES, wavesEndMs } from '../src/sky/stages'
import { EMPTY_RECORD } from '../src/storage'
import {
  BOMB, CLEAR_MS, COIN, DEAD_MS, LIVES_CHALLENGE, PLAYER, SCORE, SKY_H, SKY_W,
} from '../src/sky/tuning'
import { damageBoss } from '../src/sky/boss'

const DT = 1 / 60
const S1 = SKY_STAGES[0]!

let s: SkyState
beforeEach(() => {
  s = newSkyState(S1, 'practice')
})

function step(n: number, input: SkyInput = NO_INPUT): SkyEvent[] {
  const all: SkyEvent[] = []
  for (let i = 0; i < n; i++) {
    const ev = updateSky(s, input, DT)
    all.push(...ev)
    advanceSkyScene(s, ev, DT)
  }
  return all
}

/** 플레이어 바로 위에 적탄을 하나 놓는다 */
function bulletOnPlayer(dx = 0, dy = 0): void {
  s.bullets.push({
    x: s.player.x + dx, y: s.player.y + dy, vx: 0, vy: 0, r: 2.6,
    age: 0, life: 9000, turn: 0, turnUntil: 0,
    waveAmp: 0, waveHz: 0, baseAngle: 0,
    burstAt: 0, burstN: 0, burstSpeed: 0, hue: 'pink', big: false,
  })
}

describe('초기 상태', () => {
  it('연습은 목숨이 무한, 도전은 3', () => {
    expect(s.lives).toBe(Number.POSITIVE_INFINITY)
    expect(newSkyState(S1, 'challenge').lives).toBe(LIVES_CHALLENGE)
  })

  it('궁극기를 들고 시작한다', () => {
    expect(s.player.bombs).toBe(PLAYER.startBombs)
  })

  it('시작하자마자 무적이다 — 시작 즉시 맞으면 억울하다', () => {
    expect(s.player.invMs).toBeGreaterThan(0)
  })
})

describe('피탄 (적탄은 즉사)', () => {
  beforeEach(() => {
    s.player.invMs = 0
  })

  it('적탄에 맞으면 죽는다', () => {
    bulletOnPlayer()
    const ev = step(1)
    expect(ev).toContain('die')
    expect(s.scene).toBe('dead')
  })

  it('판정이 아주 작다 — 조금만 비켜도 안 맞는다', () => {
    bulletOnPlayer(9, 0)
    step(1)
    expect(s.scene).toBe('playing')
  })

  it('무적 중에는 안 맞는다', () => {
    s.player.invMs = 500
    bulletOnPlayer()
    step(1)
    expect(s.scene).toBe('playing')
  })

  it('죽으면 죽은 횟수가 오른다', () => {
    bulletOnPlayer()
    step(1)
    expect(s.deaths).toBe(1)
  })

  it('도전 모드는 목숨이 준다', () => {
    s = newSkyState(S1, 'challenge')
    s.player.invMs = 0
    bulletOnPlayer()
    step(1)
    expect(s.lives).toBe(LIVES_CHALLENGE - 1)
  })

  it('연습 모드는 목숨이 안 준다', () => {
    bulletOnPlayer()
    step(1)
    expect(s.lives).toBe(Number.POSITIVE_INFINITY)
  })
})

describe('적과 접촉 (죽지 않는다)', () => {
  it('파워만 한 단계 잃는다', () => {
    s.player.invMs = 0
    s.player.power = 2
    s.enemies.push({
      kind: 'bird', x: s.player.x, y: s.player.y, y0: s.player.y, w: 12, h: 10,
      hp: 99, maxHp: 99, t: 0, path: { kind: 'straight', speed: 0 },
      guns: [], gunT: [], gunN: [], hitMs: 0, alive: true, drop: null, score: 0, idx: 0,
    })
    step(1)
    expect(s.scene).toBe('playing')
    expect(s.player.power).toBe(1)
    expect(s.player.stunMs).toBeGreaterThan(0)
  })
})

describe('궁극기', () => {
  it('화면의 적탄을 지운다', () => {
    for (let i = 0; i < 12; i++) bulletOnPlayer(40 + i * 5, 0)
    step(1, { ...NO_INPUT, bomb: true })
    expect(s.bullets).toHaveLength(0)
  })

  it('지속 시간 동안 새로 나온 탄도 계속 지워진다', () => {
    step(1, { ...NO_INPUT, bomb: true })
    bulletOnPlayer(60, 0)
    step(1)
    expect(s.bullets).toHaveLength(0)
    expect(s.bombMs).toBeGreaterThan(0)
  })

  it('지속이 끝나면 다시 탄이 남는다', () => {
    step(1, { ...NO_INPUT, bomb: true })
    step(Math.ceil(BOMB.ms / (DT * 1000)) + 2)
    expect(s.bombMs).toBe(0)
    bulletOnPlayer(60, 0)
    step(1)
    expect(s.bullets.length).toBeGreaterThan(0)
  })

  it('적에게 피해를 준다', () => {
    s.enemies.push({
      kind: 'blimp', x: 300, y: 60, y0: 60, w: 28, h: 16,
      hp: 500, maxHp: 500, t: 0, path: { kind: 'straight', speed: 0 },
      guns: [], gunT: [], gunN: [], hitMs: 0, alive: true, drop: null, score: 10, idx: 0,
    })
    step(1, { ...NO_INPUT, bomb: true })
    expect(s.enemies[0]!.hp).toBe(500 - BOMB.dmg)
  })

  it('궁극기가 없으면 안 나간다', () => {
    s.player.bombs = 0
    const ev = step(1, { ...NO_INPUT, bomb: true })
    expect(ev).not.toContain('bomb')
  })
})

describe('아이템', () => {
  function drop(kind: 'power' | 'bomb' | 'coin', age = 0): void {
    s.items.push({ kind, x: s.player.x, y: s.player.y, vx: 0, vy: 0, age })
  }

  it('파워업을 먹으면 파워가 오른다', () => {
    drop('power')
    step(1)
    expect(s.player.power).toBe(1)
    expect(s.items).toHaveLength(0)
  })

  it('파워가 최대면 점수로 바뀐다', () => {
    s.player.power = 3
    drop('power')
    step(1)
    expect(s.score).toBe(1000)
  })

  it('궁극기가 꽉 찼을 때 먹으면 큰 점수 (텐가이 규칙)', () => {
    s.player.bombs = PLAYER.maxBombs
    drop('bomb')
    step(1)
    expect(s.score).toBe(SCORE.bombFull)
  })

  it('코인은 늦게 먹을수록 값이 떨어진다', () => {
    expect(coinValue(0)).toBe(COIN.max)
    expect(coinValue(COIN.decayMs)).toBe(COIN.min)
    expect(coinValue(COIN.decayMs * 5)).toBe(COIN.min)
    expect(coinValue(COIN.decayMs / 2)).toBeLessThan(COIN.max)
    expect(coinValue(COIN.decayMs / 2)).toBeGreaterThan(COIN.min)
  })
})

describe('편대', () => {
  it('예정 시각에 나온다', () => {
    expect(s.enemies).toHaveLength(0)
    step(Math.ceil(S1.waves[0]!.atMs / (DT * 1000)) + 2)
    expect(s.enemies.length).toBeGreaterThan(0)
  })

  it('편대 안에서 순서대로 나온다', () => {
    step(Math.ceil(S1.waves[0]!.atMs / (DT * 1000)) + 2)
    const first = s.enemies.length
    step(Math.ceil(S1.waves[0]!.gapMs / (DT * 1000)) + 1)
    expect(s.enemies.length).toBeGreaterThan(first)
  })

  it('적은 화면 안쪽 세로 범위에 나온다', () => {
    step(60 * 40)
    for (const e of s.enemies) {
      expect(e.y).toBeGreaterThan(0)
      expect(e.y).toBeLessThan(SKY_H)
    }
  })

  it('아이템은 편대의 마지막 한 마리만 떨군다', () => {
    const spec = S1.waves.find((w) => w.drop)!
    s.t = spec.atMs - 1
    s.waveAt = S1.waves.indexOf(spec)
    step(Math.ceil((spec.gapMs * spec.count + 100) / (DT * 1000)))
    const withDrop = s.enemies.filter((e) => e.drop !== null)
    expect(withDrop.length).toBeLessThanOrEqual(1)
  })
})

describe('보스', () => {
  function toBoss(): void {
    s.t = wavesEndMs(S1)
    s.waveAt = S1.waves.length
    s.pending = []
    step(2)
  }

  it('편대가 끝나면 나온다', () => {
    expect(s.boss).toBeNull()
    toBoss()
    expect(s.boss).not.toBeNull()
    expect(s.bossOut).toBe(true)
  })

  it('등장 연출 중에는 피해를 입지 않는다', () => {
    toBoss()
    const b = s.boss!
    expect(b.enterMs).toBeGreaterThan(0)
    expect(damageBoss(b, 100)).toBe('none')
  })

  it('페이즈가 끝나면 변신한다', () => {
    toBoss()
    const b = s.boss!
    b.enterMs = 0
    expect(damageBoss(b, b.phases[0]!.hp)).toBe('phase')
    expect(b.phase).toBe(1)
    expect(b.morphMs).toBeGreaterThan(0)
  })

  it('마지막 페이즈를 끝내면 격파 연출 뒤 클리어', () => {
    toBoss()
    const b = s.boss!
    b.enterMs = 0
    b.phase = b.phases.length - 1
    b.hp = 1
    expect(damageBoss(b, 99)).toBe('dead')
    expect(s.scene).toBe('playing')
    step(200)
    expect(s.scene).toBe('clear')
  })
})

describe('씬 전이', () => {
  it('죽으면 잠깐 뒤 되살아난다', () => {
    s.player.invMs = 0
    bulletOnPlayer()
    step(1)
    expect(s.scene).toBe('dead')
    step(Math.ceil(DEAD_MS / (DT * 1000)) + 2)
    expect(s.scene).toBe('playing')
    expect(s.player.alive).toBe(true)
  })

  it('되살아나면 파워는 초기화, 궁극기는 채워 준다', () => {
    s.player.power = 3
    s.player.bombs = 0
    respawnSky(s)
    expect(s.player.power).toBe(0)
    expect(s.player.bombs).toBe(PLAYER.startBombs)
    expect(s.player.invMs).toBeGreaterThan(0)
  })

  it('도전 모드에서 목숨이 다하면 게임 오버', () => {
    s = newSkyState(S1, 'challenge')
    s.lives = 1
    s.player.invMs = 0
    bulletOnPlayer()
    step(1)
    step(Math.ceil(DEAD_MS / (DT * 1000)) + 2)
    expect(s.scene).toBe('gameover')
  })

  it('클리어 보너스는 한 번만 붙는다', () => {
    s.scene = 'clear'
    s.player.bombs = 2
    advanceSkyScene(s, [], DT)
    const once = s.score
    expect(once).toBe(2 * SCORE.bombLeft + SCORE.noMiss)
    for (let i = 0; i < 50; i++) advanceSkyScene(s, [], DT)
    expect(s.score).toBe(once)
  })

  it('클리어 화면은 저절로 넘어가지 않는다', () => {
    s.scene = 'clear'
    for (let i = 0; i < Math.ceil(CLEAR_MS / (DT * 1000)) + 60; i++) {
      advanceSkyScene(s, [], DT)
    }
    expect(s.scene).toBe('clear')
  })
})

describe('기록', () => {
  it('클리어해야 남는다', () => {
    s.scene = 'gameover'
    s.score = 9999
    expect(skyToRecord(s, EMPTY_RECORD)).toEqual(EMPTY_RECORD)
  })

  it('더 좋은 기록만 갱신한다', () => {
    s.scene = 'clear'
    s.score = 100
    s.deaths = 5
    s.t = 200_000
    const prev = { cleared: true, bestScore: 900, bestTimeMs: 50_000, fewestDeaths: 1 }
    const r = skyToRecord(s, prev)
    expect(r.bestScore).toBe(900)
    expect(r.fewestDeaths).toBe(1)
    expect(r.bestTimeMs).toBe(50_000)
  })

  it('첫 클리어를 남긴다', () => {
    s.scene = 'clear'
    s.score = 500
    s.deaths = 2
    s.t = 90_000
    const r = skyToRecord(s, EMPTY_RECORD)
    expect(r.cleared).toBe(true)
    expect(r.bestScore).toBe(500)
    expect(r.bestTimeMs).toBe(90_000)
  })
})

describe('목숨 추가', () => {
  it('도전 모드에서 점수가 쌓이면 목숨이 는다', () => {
    s = newSkyState(S1, 'challenge')
    s.score = s.nextExtra
    const ev = step(1)
    expect(ev).toContain('extra')
    expect(s.lives).toBe(LIVES_CHALLENGE + 1)
  })
})

describe('화면 밖 정리', () => {
  it('아군 탄이 오른쪽 끝을 넘지 않는다 — 등장 전 적을 죽이면 안 된다', () => {
    s.player.power = 3
    step(120)
    for (const sh of s.shots) expect(sh.x).toBeLessThanOrEqual(SKY_W)
  })
})
