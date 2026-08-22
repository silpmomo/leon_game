import { describe, expect, it } from 'vitest'
import { SKY_STAGES } from '../src/sky/stages'
import { newSkyState, updateSky } from '../src/sky/update'
import { advanceSkyScene } from '../src/sky/scenes'
import { playStage, skyBot, skyTrace } from './helpers/skyBot'

const DT = 1 / 60

/**
 * 통합 확인.
 *
 * 기존 게임의 1-1 봇과 같은 자리다. 스테이지 데이터·물리·충돌·씬이
 * 전부 맞물려야 통과한다.
 */
describe('1탄은 실제로 깰 수 있다', () => {
  it('봇이 1탄을 클리어한다', () => {
    const s = newSkyState(SKY_STAGES[0]!, 'practice')
    const r = playStage(s, 150)
    expect(r.cleared, `${r.secs.toFixed(0)}초에 죽음 ${r.deaths}회`).toBe(true)
  })

  it('1탄에서 봇이 세 번 넘게 죽지 않는다 — 아이가 처음 잡는 탄이다', () => {
    const s = newSkyState(SKY_STAGES[0]!, 'practice')
    const r = playStage(s, 150)
    expect(r.deaths).toBeLessThanOrEqual(3)
  })

  it('클리어하면 점수가 쌓여 있다', () => {
    const s = newSkyState(SKY_STAGES[0]!, 'practice')
    const r = playStage(s, 150)
    expect(r.score).toBeGreaterThan(1000)
  })
})

describe('보스까지 도달한다', () => {
  it('편대가 다 지나가면 보스가 나온다', () => {
    const s = newSkyState(SKY_STAGES[1]!, 'practice')
    let sawBoss = false
    for (let i = 0; i < 60 * 120 && !sawBoss; i++) {
      const ev = updateSky(s, skyBot(s, i), DT)
      advanceSkyScene(s, ev, DT)
      if (s.boss) sawBoss = true
    }
    expect(sawBoss).toBe(true)
  })
})

describe('결정성 — 같은 입력이면 같은 판', () => {
  function run(frames: number): number {
    const s = newSkyState(SKY_STAGES[2]!, 'practice')
    for (let i = 0; i < frames; i++) {
      const ev = updateSky(s, skyBot(s, i), DT)
      advanceSkyScene(s, ev, DT)
    }
    return skyTrace(s)
  }

  it('두 번 돌려도 같은 결과다 — Math.random 을 쓰면 여기서 깨진다', () => {
    expect(run(900)).toBe(run(900))
  })

  /*
   * 물리·패턴·밸런스를 건드리면 이 값이 바뀐다. 바뀌었다면 의도한 변경인지
   * 확인하고 새 값을 적어 넣어라 — 모르고 바뀌었으면 그게 버그다.
   */
  it('지문이 기록해 둔 값과 같다', () => {
    expect(run(900)).toBe(1972578978)
  })
})

describe('오래 돌려도 상태가 새지 않는다', () => {
  it('탄과 적이 무한히 쌓이지 않는다', () => {
    const s = newSkyState(SKY_STAGES[5]!, 'practice')
    let maxBullets = 0
    let maxEnemies = 0
    for (let i = 0; i < 60 * 90; i++) {
      const ev = updateSky(s, skyBot(s, i), DT)
      advanceSkyScene(s, ev, DT)
      maxBullets = Math.max(maxBullets, s.bullets.length)
      maxEnemies = Math.max(maxEnemies, s.enemies.length)
    }
    expect(maxBullets).toBeLessThan(400)
    expect(maxEnemies).toBeLessThan(60)
    expect(s.shots.length).toBeLessThan(80)
    expect(s.bursts.length).toBeLessThan(80)
  })

  it('예약된 편대가 남김없이 풀린다', () => {
    const s = newSkyState(SKY_STAGES[0]!, 'practice')
    for (let i = 0; i < 60 * 80; i++) {
      const ev = updateSky(s, skyBot(s, i), DT)
      advanceSkyScene(s, ev, DT)
    }
    expect(s.pending).toHaveLength(0)
    expect(s.waveAt).toBe(SKY_STAGES[0]!.waves.length)
  })
})
