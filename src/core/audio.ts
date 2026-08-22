export type Wave = OscillatorType | 'noise'

export type SfxSpec = {
  wave: Wave
  /** 순서대로 낼 음. 0은 쉼 */
  notes: number[]
  noteMs: number
  gain: number
  /** 비브라토 세기(Hz). 파워업처럼 들뜬 소리에 쓴다 */
  vibrato?: number
  /** 음 사이를 끊지 않고 미끄러진다 */
  slide?: boolean
  /** 노이즈 필터 종류 */
  noise?: 'hat' | 'crash' | 'thud'
}

/** 음이름 → 주파수 (A4 = 440) */
const N = {
  G2: 98,
  A2: 110,
  B2: 123,
  C3: 131,
  D3: 147,
  E3: 165,
  F3: 175,
  G3: 196,
  A3: 220,
  C4: 262,
  D4: 294,
  E4: 330,
  F4: 349,
  G4: 392,
  A4: 440,
  B4: 494,
  C5: 523,
  D5: 587,
  E5: 659,
  F5: 698,
  G5: 784,
  A5: 880,
  C6: 1047,
  E6: 1319,
} as const

export const SFX: Record<string, SfxSpec> = {
  // 점프: 짧게 올라가는 블립. 연타해도 겹쳐 들리지 않게 아주 짧다
  jump: { wave: 'square', notes: [N.C5, N.G5], noteMs: 40, gain: 0.2, slide: true },

  // 코인: 위로 오르는 두 음
  coin: { wave: 'square', notes: [N.E5, N.C6], noteMs: 55, gain: 0.24 },

  // 밟기: 짧은 노이즈 퍽
  stomp: { wave: 'noise', notes: [1], noteMs: 90, gain: 0.3, noise: 'thud' },

  // 블록 튕김: 낮은 둔탁한 소리
  bump: { wave: 'triangle', notes: [N.G3, N.E3], noteMs: 55, gain: 0.22, slide: true },

  // 벽돌 깨짐: 노이즈 크래시
  brick: { wave: 'noise', notes: [1], noteMs: 160, gain: 0.26, noise: 'crash' },

  // 파워업: 비브라토 얹은 상승 아르페지오
  powerup: {
    wave: 'square',
    notes: [N.C4, N.E4, N.G4, N.C5, N.E5, N.G5],
    noteMs: 55,
    gain: 0.22,
    vibrato: 6,
  },

  // 발사: 짧게 내려가는 소리
  fire: { wave: 'sawtooth', notes: [N.A5, N.D5], noteMs: 40, gain: 0.18, slide: true },

  // 피격: 내려가는 톱니
  hurt: { wave: 'sawtooth', notes: [N.E4, N.C4, N.G3], noteMs: 70, gain: 0.24, slide: true },

  // 사망: 길게 떨어진다
  die: {
    wave: 'square',
    notes: [N.C5, N.A4, N.F4, N.D4, N.B2, N.G2],
    noteMs: 115,
    gain: 0.26,
    slide: true,
  },

  // 목숨 추가
  extraLife: { wave: 'square', notes: [N.C5, N.E5, N.G5, N.C6], noteMs: 75, gain: 0.24 },

  // 골: 팡파레
  goal: {
    wave: 'square',
    notes: [N.C5, N.E5, N.G5, N.C6, 0, N.G5, N.C6, 0, N.E6, N.C6, N.G5, N.C6],
    noteMs: 135,
    gain: 0.24,
  },

  // 메뉴 선택
  select: { wave: 'square', notes: [N.G4, N.C5], noteMs: 55, gain: 0.22 },

  // 점프대 — 점프보다 크게 튀어오르는 느낌
  spring: {
    wave: 'square',
    notes: [N.C4, N.G4, N.E5, N.C6],
    noteMs: 45,
    gain: 0.24,
    slide: true,
  },

  // 보스 피격 — 묵직한 타격
  bossHit: { wave: 'noise', notes: [1], noteMs: 130, gain: 0.3, noise: 'thud' },

  /**
   * 전기 발사 — 100만볼트.
   * 지지직거리는 노이즈 크래시 + 높은 데서 급하게 떨어지는 톱니를 겹친다.
   * 한 SFX 에 파형을 섞을 수 없으므로 bolt(노이즈)와 boltTone(톱니)을 같이 낸다.
   */
  bolt: { wave: 'noise', notes: [1, 1], noteMs: 70, gain: 0.32, noise: 'crash' },
  boltTone: {
    wave: 'sawtooth',
    notes: [N.E6, N.C6, N.G5, N.C5],
    noteMs: 45,
    gain: 0.26,
    slide: true,
    vibrato: 30,
  },

  // 하늘전투 — 자동 발사. 아주 짧고 작아야 한다. 초당 10발이 나간다
  skyShot: { wave: 'square', notes: [N.A5], noteMs: 22, gain: 0.06 },

  // 하늘전투 — 적 격추
  skyKill: { wave: 'noise', notes: [1], noteMs: 80, gain: 0.2, noise: 'crash' },

  // 하늘전투 — 보스 등장 경보
  skyAlarm: {
    wave: 'sawtooth',
    notes: [N.E4, N.A4, N.E4, N.A4],
    noteMs: 130,
    gain: 0.24,
    vibrato: 8,
  },

  // 보스 격파 — 길게 무너지는 소리
  bossDown: {
    wave: 'sawtooth',
    notes: [N.G4, N.E4, N.C4, N.G3, N.E3, N.C3, N.G2],
    noteMs: 150,
    gain: 0.28,
    slide: true,
  },
}

// ── BGM ────────────────────────────────────────────────────────
//
// 16분음표 격자 위의 스텝 시퀀서. 4마디(64스텝) 루프.
// 원곡이다 — 기존 게임 곡을 옮기지 않았다.

const STEPS_PER_BAR = 16
const BARS = 4
const TOTAL_STEPS = STEPS_PER_BAR * BARS

/** [시작 스텝, 주파수, 길이(스텝)] */
type Ev = readonly [number, number, number]

const MELODY: readonly Ev[] = [
  // 1마디 — 올라가는 동기
  [0, N.C5, 2], [2, N.E5, 2], [4, N.G5, 2], [6, N.E5, 2], [8, N.A5, 4], [12, N.G5, 4],
  // 2마디 — 정점
  [16, N.F5, 2], [18, N.A5, 2], [20, N.C6, 4], [24, N.A5, 2], [26, N.G5, 2], [28, N.F5, 4],
  // 3마디 — 되돌아옴
  [32, N.E5, 2], [34, N.G5, 2], [36, N.C5, 2], [38, N.E5, 2], [40, N.D5, 4], [44, N.E5, 4],
  // 4마디 — 마무리
  [48, N.G5, 2], [50, N.E5, 2], [52, N.C5, 4], [60, N.G4, 4],
]

const BASS: readonly Ev[] = [
  [0, N.C3, 6], [8, N.C3, 6],
  [16, N.F3, 6], [24, N.F3, 6],
  [32, N.C3, 6], [40, N.E3, 6],
  [48, N.G2, 6], [56, N.G2, 6],
]

/**
 * 하늘전투 곡. 단조로 몰아붙인다 — 슈팅에 대모험의 밝은 곡을 쓰면
 * 화면과 어긋난다. 8분음표 베이스가 계속 굴러가게 깔았다.
 */
const SKY_MELODY: readonly Ev[] = [
  // 1마디 — A단조 상승
  [0, N.A4, 2], [2, N.C5, 2], [4, N.E5, 2], [6, N.D5, 2],
  [8, N.C5, 2], [10, N.E5, 2], [12, N.A5, 4],
  // 2마디 — 긴장
  [16, N.G5, 2], [18, N.E5, 2], [20, N.F5, 2], [22, N.D5, 2],
  [24, N.E5, 4], [28, N.C5, 4],
  // 3마디 — 더 위로
  [32, N.D5, 2], [34, N.F5, 2], [36, N.A5, 2], [38, N.G5, 2],
  [40, N.F5, 2], [42, N.A5, 2], [44, N.C6, 4],
  // 4마디 — 되돌림
  [48, N.B4, 2], [50, N.D5, 2], [52, N.E5, 4], [56, N.A4, 4], [60, N.E5, 4],
]

const SKY_BASS: readonly Ev[] = [
  [0, N.A2, 3], [4, N.A2, 3], [8, N.A2, 3], [12, N.G2, 3],
  [16, N.F3, 3], [20, N.F3, 3], [24, N.C3, 3], [28, N.C3, 3],
  [32, N.D3, 3], [36, N.D3, 3], [40, N.F3, 3], [44, N.F3, 3],
  [48, N.E3, 3], [52, N.E3, 3], [56, N.A2, 3], [60, N.A2, 3],
]

/** 킥 스텝 */
const KICK = [0, 8, 16, 24, 32, 40, 48, 56]
/** 하이햇 스텝 (뒷박) */
const HAT = Array.from({ length: TOTAL_STEPS / 4 }, (_, i) => i * 4 + 2)

const MELODY_GAIN = 0.085
const BASS_GAIN = 0.1
const KICK_GAIN = 0.16
const HAT_GAIN = 0.05

export type TrackName = 'adventure' | 'sky'

/** 스텝별로 미리 묶어 O(1) 조회 */
function bucket(events: readonly Ev[]): (readonly Ev[])[] {
  const out: Ev[][] = Array.from({ length: TOTAL_STEPS }, () => [])
  for (const e of events) out[e[0] % TOTAL_STEPS]!.push(e)
  return out
}

type Track = {
  melody: (readonly Ev[])[]
  bass: (readonly Ev[])[]
  kick: readonly number[]
  /** 스네어 대신 쓰는 뒷박 노이즈 */
  hat: readonly number[]
  bpm: number
}

const TRACKS: Record<TrackName, Track> = {
  adventure: { melody: bucket(MELODY), bass: bucket(BASS), kick: KICK, hat: HAT, bpm: 132 },
  // 킥을 8분으로 깔아 계속 밀리는 느낌을 준다
  sky: {
    melody: bucket(SKY_MELODY),
    bass: bucket(SKY_BASS),
    kick: Array.from({ length: TOTAL_STEPS / 4 }, (_, i) => i * 4),
    hat: Array.from({ length: TOTAL_STEPS / 2 }, (_, i) => i * 2 + 1),
    bpm: 152,
  },
}

/** 스케줄러가 미리 채워두는 시간 */
const SCHEDULE_AHEAD_S = 0.2
const TICK_MS = 40

export type Audio = {
  play: (name: string) => void
  setMuted: (v: boolean) => void
  muted: () => boolean
  /** 사용자 제스처 안에서 불러야 한다 */
  unlock: () => void
  resume: () => Promise<void>
  startBgm: (track?: TrackName) => void
  stopBgm: () => void
  /** 진단용 — 컨텍스트 상태 */
  state: () => string
}

type AudioCtor = new () => AudioContext

export function createAudio(): Audio {
  let ctx: AudioContext | null = null
  let master: GainNode | null = null
  let noiseBuf: AudioBuffer | null = null
  let isMuted = false

  let bgmTimer: number | null = null
  let current: TrackName = 'adventure'
  let step = 0
  let nextStepTime = 0

  function ensure(): AudioContext | null {
    if (ctx) return ctx
    const w = window as unknown as {
      AudioContext?: AudioCtor
      webkitAudioContext?: AudioCtor
    }
    const Ctor = w.AudioContext ?? w.webkitAudioContext
    if (!Ctor) return null // 오디오를 못 쓰는 환경에서도 게임은 돈다
    ctx = new Ctor()
    master = ctx.createGain()
    master.gain.value = isMuted ? 0 : 0.55
    master.connect(ctx.destination)
    return ctx
  }

  /** 노이즈 원본. 타악기와 벽돌 깨짐에 쓴다 */
  function noise(c: AudioContext): AudioBuffer | null {
    if (noiseBuf) return noiseBuf
    if (typeof c.createBuffer !== 'function') return null
    const len = Math.floor(c.sampleRate * 0.4)
    const buf = c.createBuffer(1, len, c.sampleRate)
    const data = buf.getChannelData(0)
    // 결정적 의사난수 — Math.random()을 쓰지 않아 빌드마다 같은 소리가 난다
    let seed = 22222
    for (let i = 0; i < len; i++) {
      seed = (seed * 1103515245 + 12345) & 0x7fffffff
      data[i] = (seed / 0x3fffffff) - 1
    }
    noiseBuf = buf
    return buf
  }

  function envelope(startAt: number, ms: number, gain: number): GainNode | null {
    if (!ctx || !master) return null
    const g = ctx.createGain()
    const dur = ms / 1000
    g.gain.setValueAtTime(0, startAt)
    g.gain.linearRampToValueAtTime(gain, startAt + 0.005)
    g.gain.exponentialRampToValueAtTime(0.0001, startAt + dur)
    g.connect(master)
    return g
  }

  function tone(
    wave: OscillatorType,
    freq: number,
    startAt: number,
    ms: number,
    gain: number,
    opts: { vibrato?: number; slideTo?: number } = {},
  ): void {
    if (!ctx) return
    const g = envelope(startAt, ms, gain)
    if (!g) return
    const osc = ctx.createOscillator()
    osc.type = wave
    osc.frequency.setValueAtTime(freq, startAt)
    if (opts.slideTo && typeof osc.frequency.exponentialRampToValueAtTime === 'function') {
      osc.frequency.exponentialRampToValueAtTime(
        Math.max(20, opts.slideTo),
        startAt + ms / 1000,
      )
    }
    // 비브라토
    if (opts.vibrato && typeof ctx.createOscillator === 'function') {
      const lfo = ctx.createOscillator()
      const depth = ctx.createGain()
      lfo.frequency.value = opts.vibrato
      depth.gain.value = freq * 0.02
      lfo.connect(depth)
      depth.connect(osc.frequency)
      lfo.start(startAt)
      lfo.stop(startAt + ms / 1000 + 0.02)
    }
    osc.connect(g)
    osc.start(startAt)
    osc.stop(startAt + ms / 1000 + 0.02)
  }

  function noiseBurst(
    startAt: number,
    ms: number,
    gain: number,
    kind: 'hat' | 'crash' | 'thud',
  ): void {
    if (!ctx) return
    const buf = noise(ctx)
    if (!buf || typeof ctx.createBufferSource !== 'function') {
      // 노이즈를 못 쓰면 톤으로 대체한다 (소리가 아예 없는 것보다 낫다)
      tone('triangle', kind === 'hat' ? 6000 : kind === 'crash' ? 900 : 160, startAt, ms, gain * 0.6)
      return
    }
    const g = envelope(startAt, ms, gain)
    if (!g) return
    const src = ctx.createBufferSource()
    src.buffer = buf

    if (typeof ctx.createBiquadFilter === 'function') {
      const f = ctx.createBiquadFilter()
      if (kind === 'hat') {
        f.type = 'highpass'
        f.frequency.value = 7000
      } else if (kind === 'crash') {
        f.type = 'bandpass'
        f.frequency.value = 1800
      } else {
        f.type = 'lowpass'
        f.frequency.value = 400
      }
      src.connect(f)
      f.connect(g)
    } else {
      src.connect(g)
    }

    src.start(startAt)
    src.stop(startAt + ms / 1000 + 0.02)
  }

  function emit(spec: SfxSpec, at: number): void {
    const step_ = spec.noteMs / 1000
    spec.notes.forEach((f, i) => {
      if (f === 0) return
      const t = at + i * step_
      if (spec.wave === 'noise') {
        noiseBurst(t, spec.noteMs, spec.gain, spec.noise ?? 'crash')
        return
      }
      const next = spec.slide ? spec.notes[i + 1] : undefined
      tone(spec.wave, f, t, spec.noteMs, spec.gain, {
        vibrato: spec.vibrato,
        slideTo: next && next !== 0 ? next : undefined,
      })
    })
  }

  function scheduleStep(i: number, at: number, tr: Track, stepS: number): void {
    for (const [, freq, len] of tr.melody[i] ?? []) {
      tone('square', freq, at, len * stepS * 1000 * 0.92, MELODY_GAIN)
    }
    for (const [, freq, len] of tr.bass[i] ?? []) {
      tone('triangle', freq, at, len * stepS * 1000 * 0.95, BASS_GAIN)
    }
    if (tr.kick.includes(i)) noiseBurst(at, 70, KICK_GAIN, 'thud')
    if (tr.hat.includes(i)) noiseBurst(at, 35, HAT_GAIN, 'hat')
  }

  return {
    play(name: string): void {
      if (isMuted) return
      const spec = SFX[name]
      if (!spec) return
      const c = ensure()
      if (!c) return
      // 아직 suspended면 되살리고 나서라도 낸다.
      // 예전 구현은 여기서 조용히 버려서 초기 소리가 전부 사라졌다.
      if (c.state === 'suspended') {
        void c.resume().then(() => {
          if (!isMuted) emit(spec, c.currentTime + 0.01)
        })
        return
      }
      emit(spec, c.currentTime + 0.01)
    },

    setMuted(v: boolean): void {
      isMuted = v
      if (master) master.gain.value = v ? 0 : 0.55
    },

    muted(): boolean {
      return isMuted
    },

    /**
     * iOS는 사용자 제스처 안에서 컨텍스트를 만들고 소리를 한 번 내야
     * 그 뒤로 재생을 허용한다. 길이 1샘플 무음 버퍼를 흘려보낸다.
     */
    unlock(): void {
      const c = ensure()
      if (!c) return
      void c.resume()
      if (typeof c.createBuffer !== 'function' || typeof c.createBufferSource !== 'function') return
      const buf = c.createBuffer(1, 1, c.sampleRate)
      const src = c.createBufferSource()
      src.buffer = buf
      src.connect(c.destination)
      src.start(0)
    },

    async resume(): Promise<void> {
      const c = ensure()
      if (c && c.state === 'suspended') await c.resume()
    },

    startBgm(track: TrackName = 'adventure'): void {
      if (bgmTimer !== null) {
        if (track === current) return
        // 곡이 바뀌면 갈아탄다. 게임을 옮겼는데 예전 곡이 계속 나오면 안 된다
        window.clearInterval(bgmTimer)
        bgmTimer = null
      }
      const c = ensure()
      if (!c) return
      current = track
      const tr = TRACKS[track]
      const stepS = 60 / tr.bpm / 4
      step = 0
      nextStepTime = c.currentTime + 0.06

      // 룩어헤드 스케줄러. setInterval로 한 스텝씩 즉시 재생하면
      // 타이머 지터가 그대로 리듬에 실려 흔들린다.
      const tick = (): void => {
        if (!ctx || ctx.state !== 'running' || isMuted) return
        while (nextStepTime < ctx.currentTime + SCHEDULE_AHEAD_S) {
          scheduleStep(step, nextStepTime, tr, stepS)
          nextStepTime += stepS
          step = (step + 1) % TOTAL_STEPS
        }
      }
      tick()
      bgmTimer = window.setInterval(tick, TICK_MS)
    },

    stopBgm(): void {
      if (bgmTimer === null) return
      window.clearInterval(bgmTimer)
      bgmTimer = null
    },

    state(): string {
      return ctx ? ctx.state : 'none'
    },
  }
}
