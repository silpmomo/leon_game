import { describe, expect, it } from 'vitest'
import type { SkyStage } from '../src/sky/types'
import { SKY_STAGES, skyStageAt, skyStageIndex, wavesEndMs } from '../src/sky/stages'
import { assertValidSkyStage, assertValidSkyStages, bossTotalHp } from '../src/sky/schema'
import { ENEMY_BODY, firstDelay, gunInterval, spawnEnemy, stepEnemy } from '../src/sky/enemies'
import { SCROLL_SPEED, SKY_H, SKY_W } from '../src/sky/tuning'

const DT = 1 / 60

describe('스테이지 목록', () => {
  it('10탄이다', () => {
    expect(SKY_STAGES).toHaveLength(10)
  })

  it('id 가 sky-01 부터 sky-10 까지 순서대로다', () => {
    SKY_STAGES.forEach((s, i) => {
      expect(s.id).toBe(`sky-${String(i + 1).padStart(2, '0')}`)
    })
  })

  it('전부 다른 테마다 — 열 탄이 다 같아 보이면 안 된다', () => {
    expect(new Set(SKY_STAGES.map((s) => s.theme)).size).toBe(10)
  })

  it('보스 이름이 전부 다르다', () => {
    expect(new Set(SKY_STAGES.map((s) => s.boss.name)).size).toBe(10)
  })

  it('마지막 탄에 최종 보스가 있다', () => {
    const last = SKY_STAGES[9]!
    expect(last.boss.name).toBe('천공왕')
    expect(last.boss.phases.length).toBeGreaterThanOrEqual(3)
  })

  it('조회 함수가 범위를 넘어도 안 터진다', () => {
    expect(skyStageAt(-5).id).toBe('sky-01')
    expect(skyStageAt(99).id).toBe('sky-10')
    expect(skyStageIndex('sky-07')).toBe(6)
    expect(skyStageIndex('없음')).toBe(-1)
  })
})

describe('스테이지 검증 규칙', () => {
  it('열 탄 모두 규칙을 지킨다', () => {
    expect(() => { assertValidSkyStages(SKY_STAGES) }).not.toThrow()
  })

  const broken = (f: (s: SkyStage) => void): (() => void) => () => {
    const s = structuredClone(SKY_STAGES[0]) as SkyStage
    f(s)
    assertValidSkyStage(s)
  }

  it('발사 간격이 0이면 걸러낸다', () => {
    expect(broken((s) => { s.boss.phases[0]!.guns[0]!.everyMs = 0 })).toThrow(/everyMs/)
  })

  it('모르는 패턴을 걸러낸다', () => {
    expect(broken((s) => {
      s.boss.phases[0]!.guns[0]!.pattern = 'nope' as never
    })).toThrow(/패턴/)
  })

  it('보스 체력이 0이면 걸러낸다', () => {
    expect(broken((s) => { s.boss.phases[0]!.hp = 0 })).toThrow(/체력/)
  })

  it('총 없는 보스를 걸러낸다', () => {
    expect(broken((s) => { s.boss.phases[0]!.guns = [] })).toThrow(/총이 없다/)
  })

  it('화면을 다 덮는 보스를 걸러낸다', () => {
    expect(broken((s) => { s.boss.h = SKY_H })).toThrow(/피할 자리/)
  })

  it('멈춰 서는 편대를 걸러낸다', () => {
    expect(broken((s) => { s.waves[0]!.path.speed = 0 })).toThrow(/멈춰 붙는다/)
  })

  it('파워업을 안 주는 스테이지를 걸러낸다', () => {
    expect(broken((s) => {
      for (const w of s.waves) if (w.drop === 'power') w.drop = null
    })).toThrow(/파워업/)
  })

  it('편대 등장 순서가 거꾸로면 걸러낸다', () => {
    expect(broken((s) => { s.waves[1]!.atMs = 0 })).toThrow(/이르다/)
  })

  it('holdX 가 화면 밖이면 걸러낸다', () => {
    expect(broken((s) => {
      const w = s.waves.find((x) => x.path.kind === 'hover')!
      w.path.holdX = SKY_W + 50
    })).toThrow(/화면 밖/)
  })
})

describe('난이도 흐름', () => {
  it('보스가 뒤로 갈수록 세진다', () => {
    const hp = SKY_STAGES.map(bossTotalHp)
    expect(hp[9]!).toBeGreaterThan(hp[0]! * 3)
  })

  it('페이즈 수가 줄지 않는다', () => {
    const n = SKY_STAGES.map((s) => s.boss.phases.length)
    for (let i = 1; i < n.length; i++) expect(n[i]!).toBeGreaterThanOrEqual(n[i - 1]!)
  })

  it('앞 탄이 더 오래간다 — 편대 수가 충분하다', () => {
    for (const s of SKY_STAGES) {
      expect(s.waves.length, s.id).toBeGreaterThanOrEqual(8)
      expect(wavesEndMs(s), s.id).toBeGreaterThan(30_000)
    }
  })

  it('탄속이 뒤로 갈수록 빨라진다', () => {
    const avg = (s: SkyStage): number => {
      const speeds = s.waves.flatMap((w) => w.guns.map((g) => g.speed ?? 120))
      return speeds.reduce((a, b) => a + b, 0) / Math.max(1, speeds.length)
    }
    expect(avg(SKY_STAGES[9]!)).toBeGreaterThan(avg(SKY_STAGES[0]!))
  })
})

describe('적 생성과 이동', () => {
  const wave = SKY_STAGES[0]!.waves[0]!

  it('오른쪽 화면 밖에서 나온다', () => {
    expect(spawnEnemy(wave, 0).x).toBeGreaterThan(SKY_W)
  })

  it('세로 위치가 화면 안에 들어온다 — 비율이 1을 넘어도', () => {
    for (const dy of [-0.9, 0, 0.4, 3.3]) {
      for (let i = 0; i < 8; i++) {
        const e = spawnEnemy({ ...wave, dy }, i)
        expect(e.y, `dy ${dy} idx ${i}`).toBeGreaterThan(0)
        expect(e.y).toBeLessThan(SKY_H)
      }
    }
  })

  it('왼쪽으로 흘러간다', () => {
    const e = spawnEnemy(wave, 0)
    const x0 = e.x
    for (let i = 0; i < 30; i++) stepEnemy(e, DT)
    expect(e.x).toBeLessThan(x0)
  })

  it('포탑은 배경과 같은 속도로 흐른다 — 지형에 붙어 보여야 한다', () => {
    const e = spawnEnemy(
      { ...wave, kind: 'turret', path: { kind: 'anchor', speed: 0 } }, 0,
    )
    const x0 = e.x
    for (let i = 0; i < 60; i++) stepEnemy(e, DT)
    expect(x0 - e.x).toBeCloseTo(SCROLL_SPEED, 0)
  })

  it('사인 이동은 기준선 둘레에서 흔들린다', () => {
    const e = spawnEnemy(
      { ...wave, path: { kind: 'sine', speed: 60, amp: 20, hz: 1 } }, 0,
    )
    let min = Infinity
    let max = -Infinity
    for (let i = 0; i < 120; i++) {
      stepEnemy(e, DT)
      min = Math.min(min, e.y)
      max = Math.max(max, e.y)
    }
    expect(max - min).toBeGreaterThan(20)
  })

  it('모든 적 원형에 체력과 점수가 있다', () => {
    for (const [kind, b] of Object.entries(ENEMY_BODY)) {
      expect(b.hp, kind).toBeGreaterThan(0)
      expect(b.score, kind).toBeGreaterThan(0)
      expect(b.w, kind).toBeGreaterThan(0)
    }
  })
})

describe('발사 타이밍', () => {
  it('첫 발은 늦어도 0.7초 안에 나간다', () => {
    for (const s of SKY_STAGES) {
      for (const w of s.waves) {
        w.guns.forEach((g, i) => {
          if (g.delayMs !== undefined) return
          expect(firstDelay(g, i), `${s.id} ${g.pattern}`).toBeLessThanOrEqual(700 + i * 140)
        })
      }
    }
  })

  it('연사를 걸면 정해진 발수마다 쉰다', () => {
    const g = { pattern: 'aimed' as const, everyMs: 100, burstShots: 3, restMs: 900 }
    expect(gunInterval(g, 1)).toBe(100)
    expect(gunInterval(g, 2)).toBe(100)
    expect(gunInterval(g, 3)).toBe(900)
    expect(gunInterval(g, 4)).toBe(100)
  })

  it('연사 설정이 없으면 늘 같은 간격이다', () => {
    const g = { pattern: 'aimed' as const, everyMs: 250 }
    for (let n = 1; n < 8; n++) expect(gunInterval(g, n)).toBe(250)
  })
})
