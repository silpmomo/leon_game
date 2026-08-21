import { describe, expect, it } from 'vitest'
import { SFX } from '../src/core/audio'

/** rules.ts 의 RuleEvent 유니온과 같아야 한다 */
const RULE_EVENTS = [
  'stomp',
  'hurt',
  'die',
  'coin',
  'powerup',
  'bump',
  'brick',
  'fire',
  'goal',
  'extraLife',
  'jump',
] as const

describe('SFX 테이블', () => {
  it('모든 RuleEvent에 소리가 정의되어 있다', () => {
    const missing = RULE_EVENTS.filter((e) => !(e in SFX))
    expect(missing).toEqual([])
  })

  it('메뉴 선택 소리도 있다', () => {
    expect(SFX.select).toBeDefined()
  })

  it('모든 소리가 유효한 파형과 음을 가진다', () => {
    for (const [name, spec] of Object.entries(SFX)) {
      expect(['sine', 'square', 'sawtooth', 'triangle'], name).toContain(spec.wave)
      expect(spec.notes.length, name).toBeGreaterThan(0)
      for (const f of spec.notes) {
        expect(f, `${name} 의 주파수 ${f}`).toBeGreaterThan(20)
        expect(f, `${name} 의 주파수 ${f}`).toBeLessThan(20_000)
      }
      expect(spec.noteMs, name).toBeGreaterThan(0)
      expect(spec.gain, name).toBeGreaterThan(0)
      expect(spec.gain, name).toBeLessThanOrEqual(1)
    }
  })

  it('코인은 짧고 위로 오르는 두 음이다', () => {
    expect(SFX.coin!.notes).toHaveLength(2)
    expect(SFX.coin!.notes[1]!).toBeGreaterThan(SFX.coin!.notes[0]!)
    expect(SFX.coin!.noteMs).toBeLessThan(120)
  })

  it('사망은 내려가는 음이다', () => {
    const n = SFX.die!.notes
    expect(n[n.length - 1]!).toBeLessThan(n[0]!)
  })

  it('파워업은 올라가는 음이다', () => {
    const n = SFX.powerup!.notes
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

  it('모듈을 import하는 것만으로 AudioContext를 만들지 않는다', () => {
    // 이 테스트가 node 환경에서 도는 것 자체가 증명이다.
    // 최상단에서 new AudioContext()를 하면 여기 오기 전에 ReferenceError로 죽는다.
    expect(typeof SFX).toBe('object')
    expect(typeof window).toBe('undefined')
  })
})
