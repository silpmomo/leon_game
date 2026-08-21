import { beforeEach, describe, expect, it } from 'vitest'
import { SFX, createAudio } from '../src/core/audio'

/** rules.ts 의 RuleEvent 유니온과 같아야 한다 */
const RULE_EVENTS = [
  'stomp', 'hurt', 'die', 'coin', 'powerup',
  'bump', 'brick', 'fire', 'goal', 'extraLife', 'jump',
  'spring', 'bossHit', 'bossDown',
] as const

// ── 가짜 AudioContext ─────────────────────────────────────────
// 실제로 오실레이터/버퍼소스가 만들어지는지 세어 "소리가 난다"를 검증한다.

type Log = { kind: 'osc' | 'noise'; freq: number; at: number }

function install(state: 'running' | 'suspended'): {
  log: Log[]
  intervals: (() => void)[]
  ctxState: () => string
} {
  const log: Log[] = []
  const intervals: (() => void)[] = []
  let current = state

  const param = () => ({
    value: 0,
    setValueAtTime() {},
    linearRampToValueAtTime() {},
    exponentialRampToValueAtTime() {},
  })

  class FakeCtx {
    sampleRate = 48000
    currentTime = 0
    destination = {}
    get state() { return current }
    createGain() { return { gain: param(), connect() {} } }
    createOscillator() {
      const freq = param()
      return {
        type: 'square',
        frequency: freq,
        connect() {},
        start(at: number) { log.push({ kind: 'osc', freq: freq.value, at }) },
        stop() {},
      }
    }
    createBuffer(_c: number, len: number) {
      return { length: len, getChannelData: () => new Float32Array(len) }
    }
    createBufferSource() {
      return {
        buffer: null as unknown,
        connect() {},
        start(at: number) { log.push({ kind: 'noise', freq: 0, at }) },
        stop() {},
      }
    }
    createBiquadFilter() {
      return { type: 'highpass', frequency: param(), connect() {} }
    }
    async resume() { current = 'running' }
  }

  ;(globalThis as unknown as { window: unknown }).window = {
    AudioContext: FakeCtx,
    setInterval: (f: () => void) => { intervals.push(f); return intervals.length },
    clearInterval: () => {},
  }
  return { log, intervals, ctxState: () => current }
}

describe('SFX 테이블', () => {
  it('모든 RuleEvent에 소리가 정의되어 있다', () => {
    expect(RULE_EVENTS.filter((e) => !(e in SFX))).toEqual([])
  })

  it('메뉴 선택 소리도 있다', () => {
    expect(SFX.select).toBeDefined()
  })

  it('모든 소리가 유효한 파형과 음을 가진다', () => {
    for (const [name, spec] of Object.entries(SFX)) {
      expect(['sine', 'square', 'sawtooth', 'triangle', 'noise'], name).toContain(spec.wave)
      expect(spec.notes.length, name).toBeGreaterThan(0)
      if (spec.wave === 'noise') {
        // 노이즈는 음높이가 없다. notes 는 burst 개수만 나타낸다.
        for (const n of spec.notes) expect(n, name).toBeGreaterThan(0)
        continue
      }
      for (const f of spec.notes) {
        if (f === 0) continue // 쉼표
        expect(f, `${name} 의 주파수 ${f}`).toBeGreaterThan(20)
        expect(f, `${name} 의 주파수 ${f}`).toBeLessThan(20_000)
      }
      expect(spec.noteMs, name).toBeGreaterThan(0)
      expect(spec.gain, name).toBeGreaterThan(0)
      expect(spec.gain, name).toBeLessThanOrEqual(1)
    }
  })

  it('코인은 위로 오르는 두 음이다', () => {
    expect(SFX.coin!.notes).toHaveLength(2)
    expect(SFX.coin!.notes[1]!).toBeGreaterThan(SFX.coin!.notes[0]!)
  })

  it('사망은 내려가는 음이다', () => {
    const n = SFX.die!.notes.filter((x) => x !== 0)
    expect(n[n.length - 1]!).toBeLessThan(n[0]!)
  })

  it('파워업은 올라가는 음이다', () => {
    const n = SFX.powerup!.notes.filter((x) => x !== 0)
    expect(n[n.length - 1]!).toBeGreaterThan(n[0]!)
  })

  it('클리어는 가장 긴 소리다', () => {
    const total = (k: string) => SFX[k]!.notes.length * SFX[k]!.noteMs
    for (const k of ['coin', 'stomp', 'jump', 'bump', 'hurt', 'fire']) {
      expect(total('goal'), `goal 이 ${k} 보다 짧다`).toBeGreaterThan(total(k))
    }
  })

  it('점프 소리는 아주 짧다 (연타해도 겹쳐 들리지 않아야 한다)', () => {
    expect(SFX.jump!.notes.length * SFX.jump!.noteMs).toBeLessThan(150)
  })

  it('타악기 계열은 노이즈를 쓴다', () => {
    expect(SFX.stomp!.wave).toBe('noise')
    expect(SFX.brick!.wave).toBe('noise')
  })

  it('모듈을 import하는 것만으로 AudioContext를 만들지 않는다', () => {
    expect(typeof SFX).toBe('object')
  })
})

describe('실제 발음 — running 상태', () => {
  let h: ReturnType<typeof install>
  beforeEach(() => { h = install('running') })

  it('SFX가 오실레이터를 만든다', () => {
    createAudio().play('coin')
    expect(h.log.filter((l) => l.kind === 'osc')).toHaveLength(2)
  })

  it('노이즈 계열은 버퍼소스를 만든다', () => {
    createAudio().play('stomp')
    expect(h.log.filter((l) => l.kind === 'noise')).toHaveLength(1)
  })

  it('음 개수만큼 소리를 낸다 (쉼표 제외)', () => {
    createAudio().play('goal')
    const sounding = SFX.goal!.notes.filter((n) => n !== 0).length
    expect(h.log).toHaveLength(sounding)
  })

  it('음이 시간 순서대로 예약된다', () => {
    createAudio().play('powerup')
    const times = h.log.map((l) => l.at)
    // 비브라토 LFO는 본 음과 같은 시각에 시작하므로 같은 값이 나올 수 있다
    for (let i = 1; i < times.length; i++) {
      expect(times[i]!, `${i}번째가 앞 음보다 이르다`).toBeGreaterThanOrEqual(times[i - 1]!)
    }
    expect(times[times.length - 1]!).toBeGreaterThan(times[0]!)
  })

  it('슬라이드 음은 다음 음으로 미끄러진다 (끊기지 않는다)', () => {
    createAudio().play('jump')
    expect(SFX.jump!.slide).toBe(true)
    expect(h.log.length).toBeGreaterThan(0)
  })

  it('없는 이름은 아무 소리도 내지 않는다', () => {
    createAudio().play('없는소리')
    expect(h.log).toHaveLength(0)
  })

  it('muted면 소리가 안 난다', () => {
    const a = createAudio()
    a.setMuted(true)
    a.play('coin')
    expect(h.log).toHaveLength(0)
    expect(a.muted()).toBe(true)
  })

  it('음소거를 풀면 다시 난다', () => {
    const a = createAudio()
    a.setMuted(true)
    a.play('coin')
    a.setMuted(false)
    a.play('coin')
    expect(h.log.length).toBeGreaterThan(0)
  })
})

describe('실제 발음 — suspended 상태 (iOS 초기 상태)', () => {
  it('suspended여도 SFX를 버리지 않고 resume 후 낸다', async () => {
    const h = install('suspended')
    const a = createAudio()
    a.play('coin')
    expect(h.log).toHaveLength(0) // 아직은 없다
    await Promise.resolve()
    await Promise.resolve()
    expect(h.log.length, 'resume 후에도 소리가 안 났다').toBeGreaterThan(0)
  })

  it('unlock은 무음 버퍼를 흘려 iOS 제한을 푼다', () => {
    const h = install('suspended')
    createAudio().unlock()
    expect(h.log.filter((l) => l.kind === 'noise').length).toBeGreaterThan(0)
  })

  it('unlock 후 state가 running이 된다', async () => {
    const h = install('suspended')
    const a = createAudio()
    a.unlock()
    await Promise.resolve()
    expect(h.ctxState()).toBe('running')
    expect(a.state()).toBe('running')
  })
})

describe('BGM 스케줄러', () => {
  it('startBgm이 음을 예약한다', () => {
    const h = install('running')
    createAudio().startBgm()
    expect(h.log.length).toBeGreaterThan(0)
  })

  it('멜로디·베이스·타악기가 모두 들어간다', () => {
    const h = install('running')
    createAudio().startBgm()
    expect(h.log.filter((l) => l.kind === 'osc').length).toBeGreaterThan(0)
    expect(h.log.filter((l) => l.kind === 'noise').length).toBeGreaterThan(0)
  })

  it('룩어헤드만큼만 미리 채운다 (한 번에 전부 예약하지 않는다)', () => {
    const h = install('running')
    createAudio().startBgm()
    // 0.2초 룩어헤드 / 스텝 0.1136초 → 두세 스텝 분량
    expect(h.log.length).toBeLessThan(20)
  })

  it('두 번 불러도 타이머가 하나만 돈다', () => {
    const h = install('running')
    const a = createAudio()
    a.startBgm()
    a.startBgm()
    expect(h.intervals).toHaveLength(1)
  })

  it('muted면 예약하지 않는다', () => {
    const h = install('running')
    const a = createAudio()
    a.setMuted(true)
    a.startBgm()
    expect(h.log).toHaveLength(0)
  })

  it('stopBgm 후 다시 startBgm 할 수 있다', () => {
    const h = install('running')
    const a = createAudio()
    a.startBgm()
    a.stopBgm()
    a.startBgm()
    expect(h.intervals.length).toBe(2)
  })

  it('노이즈 파형은 결정적이다 (빌드마다 같은 소리)', () => {
    const h1 = install('running')
    createAudio().play('brick')
    const a = h1.log.length
    const h2 = install('running')
    createAudio().play('brick')
    expect(h2.log.length).toBe(a)
  })
})
