import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import level from '../src/levels/1-1.json'
import {
  compress,
  expand,
  runReplay,
  type Replay,
  type Snapshot,
} from '../src/game/replay'
import { TILE } from '../src/engine/tuning'
import type { LevelData } from '../src/types'

const LEVEL = level as LevelData
const FIXTURE = resolve(__dirname, 'fixtures/replay-run.json')

/**
 * 결정적인 "오른쪽으로 달리며 주기적으로 점프" 입력.
 * Math.random()을 쓰지 않는다 — 매번 같은 시퀀스여야 한다.
 */
function scriptedRun(frames: number): Replay {
  const out: Replay['frames'] = []
  for (let i = 0; i < frames; i++) {
    const jumping = i % 48 >= 8 && i % 48 < 26 // 48프레임 주기로 18프레임 유지
    out.push({ l: 0, r: 1, j: jumping ? 1 : 0, f: 0 })
  }
  return { level: '1-1', mode: 'practice', frames: out }
}

describe('compress / expand', () => {
  it('왕복해도 같다', () => {
    const r = scriptedRun(200)
    expect(expand(compress(r.frames))).toEqual(r.frames)
  })

  it('프레임당 문자 하나다', () => {
    expect(compress(scriptedRun(500).frames)).toHaveLength(500)
  })

  it('네 버튼 조합을 모두 구분한다', () => {
    const all: Replay['frames'] = []
    for (let v = 0; v < 16; v++) {
      all.push({
        l: ((v >> 0) & 1) as 0 | 1,
        r: ((v >> 1) & 1) as 0 | 1,
        j: ((v >> 2) & 1) as 0 | 1,
        f: ((v >> 3) & 1) as 0 | 1,
      })
    }
    expect(expand(compress(all))).toEqual(all)
    expect(new Set(compress(all)).size).toBe(16)
  })
})

describe('결정성', () => {
  it('같은 입력을 두 번 돌리면 완전히 같은 결과가 나온다', () => {
    const r = scriptedRun(900)
    expect(runReplay(LEVEL, r)).toEqual(runReplay(LEVEL, r))
  })

  it('방향 입력을 한 프레임만 빼도 결과가 달라진다 (테스트가 실제로 민감하다)', () => {
    const a = scriptedRun(900)
    const b: Replay = {
      ...a,
      frames: a.frames.map((f, i) => (i === 100 ? { ...f, r: 0 as const } : f)),
    }
    const ra = runReplay(LEVEL, a)
    const rb = runReplay(LEVEL, b)
    expect(rb.traceHash).not.toBe(ra.traceHash)
  })

  it('점프 한 사이클을 통째로 빼면 결과가 달라진다', () => {
    // 한 프레임만 건드려서는 안 되는 경우가 있다. 공중에서 누른 점프는 버퍼에만
    // 담기고 착지 전에 만료될 수 있고, 착지 프레임의 입력을 지워도 이미 채워진
    // 버퍼가 점프를 발동시킨다. 둘 다 정상 동작이므로 사이클 전체를 뺀다.
    const a = scriptedRun(900)
    const b: Replay = {
      ...a,
      frames: a.frames.map((f, i) => (i >= 104 && i <= 130 ? { ...f, j: 0 as const } : f)),
    }
    expect(runReplay(LEVEL, b).traceHash).not.toBe(runReplay(LEVEL, a).traceHash)
  })

  it('궤적 해시는 최종 상태가 같아도 경로가 다르면 달라진다', () => {
    // 부활은 최종 위치를 체크포인트로 되돌려 놓기 때문에, 최종 상태만
    // 비교하면 도중 차이를 놓친다. traceHash 가 그 구멍을 막는다.
    const a = scriptedRun(900)
    const b: Replay = {
      ...a,
      frames: a.frames.map((f, i) => (i >= 200 && i < 210 ? { ...f, r: 0 as const } : f)),
    }
    const ra = runReplay(LEVEL, a)
    const rb = runReplay(LEVEL, b)
    expect(rb.traceHash).not.toBe(ra.traceHash)
  })

  it('플레이어가 실제로 앞으로 나아간다 (빈 리플레이가 아니다)', () => {
    const snap = runReplay(LEVEL, scriptedRun(900))
    expect(snap.x).toBeGreaterThan(20 * TILE)
  })
})

describe('골든 스냅샷', () => {
  it('물리·규칙이 바뀌지 않았다', () => {
    const snap = runReplay(LEVEL, scriptedRun(900))

    if (!existsSync(FIXTURE)) {
      mkdirSync(dirname(FIXTURE), { recursive: true })
      writeFileSync(FIXTURE, `${JSON.stringify(snap, null, 2)}\n`, 'utf-8')
      console.warn(
        `골든 스냅샷을 새로 만들었다: ${FIXTURE}\n`
          + '내용을 확인하고 커밋해라. 이후 이 값이 바뀌면 테스트가 실패한다.',
      )
      return
    }

    const golden = JSON.parse(readFileSync(FIXTURE, 'utf-8')) as Snapshot
    expect(snap).toEqual(golden)
  })
})
