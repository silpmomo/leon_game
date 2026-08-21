export type SfxSpec = {
  wave: OscillatorType
  notes: number[]
  noteMs: number
  gain: number
}

/** 음이름 → 주파수 (A4 = 440) */
const N = {
  G2: 98,
  A2: 110,
  C3: 131,
  E3: 165,
  G3: 196,
  C4: 262,
  E4: 330,
  G4: 392,
  A4: 440,
  C5: 523,
  E5: 659,
  G5: 784,
  C6: 1047,
} as const

export const SFX: Record<string, SfxSpec> = {
  jump: { wave: 'square', notes: [N.C5, N.G5], noteMs: 45, gain: 0.18 },
  coin: { wave: 'square', notes: [N.E5, N.C6], noteMs: 55, gain: 0.22 },
  stomp: { wave: 'triangle', notes: [N.G4, N.C4], noteMs: 50, gain: 0.24 },
  bump: { wave: 'triangle', notes: [N.G3], noteMs: 60, gain: 0.18 },
  brick: { wave: 'sawtooth', notes: [N.C4, N.G3, N.E3], noteMs: 40, gain: 0.2 },
  powerup: { wave: 'square', notes: [N.C4, N.E4, N.G4, N.C5, N.E5], noteMs: 60, gain: 0.2 },
  fire: { wave: 'sawtooth', notes: [N.G5, N.C5], noteMs: 35, gain: 0.16 },
  hurt: { wave: 'sawtooth', notes: [N.E4, N.C4, N.G3], noteMs: 70, gain: 0.22 },
  die: { wave: 'square', notes: [N.C5, N.G4, N.E4, N.C4, N.G2], noteMs: 110, gain: 0.24 },
  extraLife: { wave: 'square', notes: [N.C5, N.E5, N.G5, N.C6], noteMs: 80, gain: 0.22 },
  goal: {
    wave: 'square',
    notes: [N.C4, N.E4, N.G4, N.C5, N.E5, N.G5, N.C6, N.G5, N.C6],
    noteMs: 130,
    gain: 0.22,
  },
  select: { wave: 'square', notes: [N.G4, N.C5], noteMs: 50, gain: 0.2 },
}

/** BGM: (음, 길이배수) 쌍의 루프 */
const BGM_MELODY: [number, number][] = [
  [N.C5, 1],
  [N.E5, 1],
  [N.G5, 1],
  [N.E5, 1],
  [N.A4, 1],
  [N.C5, 1],
  [N.E5, 2],
  [N.G4, 1],
  [N.C5, 1],
  [N.E5, 1],
  [N.C5, 1],
  [N.E4, 1],
  [N.G4, 1],
  [N.C5, 2],
]
const BGM_BASS: [number, number][] = [
  [N.C3, 2],
  [N.G2, 2],
  [N.A2, 2],
  [N.E3, 2],
  [N.C3, 2],
  [N.G2, 2],
  [N.C3, 2],
  [N.G2, 2],
]
const BGM_STEP_MS = 160

export type Audio = {
  play: (name: string) => void
  setMuted: (v: boolean) => void
  resume: () => Promise<void>
  startBgm: () => void
  stopBgm: () => void
}

type AudioCtor = new () => AudioContext

export function createAudio(): Audio {
  let ctx: AudioContext | null = null
  let master: GainNode | null = null
  let muted = false
  let bgmTimer: number | null = null

  function ensure(): AudioContext | null {
    if (ctx) return ctx
    const w = window as unknown as { AudioContext?: AudioCtor; webkitAudioContext?: AudioCtor }
    const Ctor = w.AudioContext ?? w.webkitAudioContext
    if (!Ctor) return null // 오디오를 못 쓰는 환경에서도 게임은 돈다
    ctx = new Ctor()
    master = ctx.createGain()
    master.gain.value = muted ? 0 : 0.5
    master.connect(ctx.destination)
    return ctx
  }

  function tone(
    wave: OscillatorType,
    freq: number,
    startAt: number,
    ms: number,
    gain: number,
  ): void {
    if (!ctx || !master) return
    const osc = ctx.createOscillator()
    const g = ctx.createGain()
    osc.type = wave
    osc.frequency.value = freq
    // 짧은 감쇠 엔벨로프 — 클릭 노이즈를 막는다
    const dur = ms / 1000
    g.gain.setValueAtTime(0, startAt)
    g.gain.linearRampToValueAtTime(gain, startAt + 0.005)
    g.gain.exponentialRampToValueAtTime(0.0001, startAt + dur)
    osc.connect(g)
    g.connect(master)
    osc.start(startAt)
    osc.stop(startAt + dur + 0.02)
  }

  return {
    play(name: string): void {
      if (muted) return
      const spec = SFX[name]
      if (!spec) return
      const c = ensure()
      if (!c || c.state !== 'running') return
      spec.notes.forEach((f, i) => {
        tone(spec.wave, f, c.currentTime + (i * spec.noteMs) / 1000, spec.noteMs, spec.gain)
      })
    },

    setMuted(v: boolean): void {
      muted = v
      if (master) master.gain.value = v ? 0 : 0.5
    },

    async resume(): Promise<void> {
      const c = ensure()
      if (c && c.state === 'suspended') await c.resume()
    },

    startBgm(): void {
      if (bgmTimer !== null) return
      let step = 0
      const tick = (): void => {
        const c = ensure()
        if (c && c.state === 'running' && !muted) {
          const m = BGM_MELODY[step % BGM_MELODY.length]!
          const b = BGM_BASS[step % BGM_BASS.length]!
          tone('square', m[0], c.currentTime, BGM_STEP_MS * m[1] * 0.9, 0.07)
          if (step % 2 === 0) tone('triangle', b[0], c.currentTime, BGM_STEP_MS * 1.8, 0.09)
        }
        step += 1
      }
      bgmTimer = window.setInterval(tick, BGM_STEP_MS)
    },

    stopBgm(): void {
      if (bgmTimer === null) return
      window.clearInterval(bgmTimer)
      bgmTimer = null
    },
  }
}
