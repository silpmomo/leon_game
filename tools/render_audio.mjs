/**
 * BGM·효과음을 WAV로 렌더한다. 브라우저 없이 귀로 확인하는 용도.
 *
 * src/core/audio.ts 의 신호 생성을 그대로 흉내낸다 — 파형·엔벨로프·필터가
 * 같아야 미리듣기가 의미 있다. 게임 코드는 이 파일을 쓰지 않는다.
 *
 *   node tools/render_audio.mjs
 *   → tools/.build/bgm.wav, tools/.build/sfx.wav
 */
import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const OUT = join(ROOT, 'tools', '.build')
const SR = 44100
const MASTER = 0.55

// ── audio.ts 와 같은 음표·시퀀스 ─────────────────────────────
const N = {
  G2: 98, A2: 110, B2: 123, C3: 131, E3: 165, F3: 175, G3: 196, A3: 220,
  C4: 262, D4: 294, E4: 330, F4: 349, G4: 392, A4: 440, B4: 494,
  C5: 523, D5: 587, E5: 659, F5: 698, G5: 784, A5: 880, C6: 1047, E6: 1319,
}

const BPM = 132
const STEP_S = 60 / BPM / 4
const TOTAL_STEPS = 64

const MELODY = [
  [0, N.C5, 2], [2, N.E5, 2], [4, N.G5, 2], [6, N.E5, 2], [8, N.A5, 4], [12, N.G5, 4],
  [16, N.F5, 2], [18, N.A5, 2], [20, N.C6, 4], [24, N.A5, 2], [26, N.G5, 2], [28, N.F5, 4],
  [32, N.E5, 2], [34, N.G5, 2], [36, N.C5, 2], [38, N.E5, 2], [40, N.D5, 4], [44, N.E5, 4],
  [48, N.G5, 2], [50, N.E5, 2], [52, N.C5, 4], [60, N.G4, 4],
]
const BASS = [
  [0, N.C3, 6], [8, N.C3, 6], [16, N.F3, 6], [24, N.F3, 6],
  [32, N.C3, 6], [40, N.E3, 6], [48, N.G2, 6], [56, N.G2, 6],
]
const KICK = [0, 8, 16, 24, 32, 40, 48, 56]
const HAT = Array.from({ length: 16 }, (_, i) => i * 4 + 2)

const SFX = {
  jump: { wave: 'square', notes: [N.C5, N.G5], noteMs: 40, gain: 0.2, slide: true },
  coin: { wave: 'square', notes: [N.E5, N.C6], noteMs: 55, gain: 0.24 },
  stomp: { wave: 'noise', notes: [1], noteMs: 90, gain: 0.3, noise: 'thud' },
  bump: { wave: 'triangle', notes: [N.G3, N.E3], noteMs: 55, gain: 0.22, slide: true },
  brick: { wave: 'noise', notes: [1], noteMs: 160, gain: 0.26, noise: 'crash' },
  powerup: { wave: 'square', notes: [N.C4, N.E4, N.G4, N.C5, N.E5, N.G5], noteMs: 55, gain: 0.22, vibrato: 6 },
  fire: { wave: 'sawtooth', notes: [N.A5, N.D5], noteMs: 40, gain: 0.18, slide: true },
  hurt: { wave: 'sawtooth', notes: [N.E4, N.C4, N.G3], noteMs: 70, gain: 0.24, slide: true },
  die: { wave: 'square', notes: [N.C5, N.A4, N.F4, N.D4, N.B2, N.G2], noteMs: 115, gain: 0.26, slide: true },
  extraLife: { wave: 'square', notes: [N.C5, N.E5, N.G5, N.C6], noteMs: 75, gain: 0.24 },
  goal: { wave: 'square', notes: [N.C5, N.E5, N.G5, N.C6, 0, N.G5, N.C6, 0, N.E6, N.C6, N.G5, N.C6], noteMs: 135, gain: 0.24 },
  select: { wave: 'square', notes: [N.G4, N.C5], noteMs: 55, gain: 0.22 },
}

// ── 신호 생성 ────────────────────────────────────────────────
function oscSample(wave, phase) {
  const t = phase % 1
  switch (wave) {
    case 'square': return t < 0.5 ? 1 : -1
    case 'sawtooth': return 2 * t - 1
    case 'triangle': return 4 * Math.abs(t - 0.5) - 1
    default: return Math.sin(2 * Math.PI * t)
  }
}

/** audio.ts 의 엔벨로프: 5ms 어택 → 지수 감쇠 */
function env(tRel, durS, gain) {
  const attack = 0.005
  if (tRel < 0) return 0
  if (tRel < attack) return gain * (tRel / attack)
  if (tRel > durS) return 0
  const k = Math.log(0.0001 / gain) / durS
  return gain * Math.exp(k * tRel)
}

function addTone(buf, startS, durS, wave, freq, gain, opts = {}) {
  const n0 = Math.floor(startS * SR)
  const n1 = Math.min(buf.length, Math.ceil((startS + durS + 0.02) * SR))
  let phase = 0
  for (let n = n0; n < n1; n++) {
    const tRel = (n - n0) / SR
    let f = freq
    if (opts.slideTo) {
      const p = Math.min(1, tRel / durS)
      f = freq * Math.pow(Math.max(20, opts.slideTo) / freq, p)
    }
    if (opts.vibrato) f += freq * 0.02 * Math.sin(2 * Math.PI * opts.vibrato * tRel)
    phase += f / SR
    buf[n] += oscSample(wave, phase) * env(tRel, durS, gain) * MASTER
  }
}

/** 결정적 노이즈 + 한 극점 필터 (audio.ts 의 BiquadFilter 근사) */
let seed = 22222
function nextNoise() {
  seed = (seed * 1103515245 + 12345) & 0x7fffffff
  return seed / 0x3fffffff - 1
}

function addNoise(buf, startS, durS, gain, kind) {
  const n0 = Math.floor(startS * SR)
  const n1 = Math.min(buf.length, Math.ceil((startS + durS + 0.02) * SR))
  const cutoff = kind === 'hat' ? 7000 : kind === 'crash' ? 1800 : 400
  const a = Math.exp((-2 * Math.PI * cutoff) / SR)
  let lp = 0
  let prev = 0
  for (let n = n0; n < n1; n++) {
    const x = nextNoise()
    lp = a * lp + (1 - a) * x
    let y
    if (kind === 'hat') y = x - lp          // 하이패스
    else if (kind === 'crash') y = lp - (lp - prev) * 0.5 // 밴드패스 흉내
    else y = lp                              // 로우패스
    prev = lp
    const tRel = (n - n0) / SR
    buf[n] += y * env(tRel, durS, gain) * MASTER * 1.6
  }
}

function renderSfx(buf, spec, at) {
  const stepS = spec.noteMs / 1000
  spec.notes.forEach((f, i) => {
    if (f === 0) return
    const t = at + i * stepS
    if (spec.wave === 'noise') {
      addNoise(buf, t, stepS, spec.gain, spec.noise ?? 'crash')
      return
    }
    const next = spec.slide ? spec.notes[i + 1] : undefined
    addTone(buf, t, stepS, spec.wave, f, spec.gain, {
      vibrato: spec.vibrato,
      slideTo: next && next !== 0 ? next : undefined,
    })
  })
  return spec.notes.length * stepS
}

// ── WAV 쓰기 ─────────────────────────────────────────────────
function writeWav(path, samples) {
  const n = samples.length
  const b = Buffer.alloc(44 + n * 2)
  b.write('RIFF', 0)
  b.writeUInt32LE(36 + n * 2, 4)
  b.write('WAVE', 8)
  b.write('fmt ', 12)
  b.writeUInt32LE(16, 16)
  b.writeUInt16LE(1, 20)
  b.writeUInt16LE(1, 22)
  b.writeUInt32LE(SR, 24)
  b.writeUInt32LE(SR * 2, 28)
  b.writeUInt16LE(2, 32)
  b.writeUInt16LE(16, 34)
  b.write('data', 36)
  let clipped = 0
  for (let i = 0; i < n; i++) {
    let v = samples[i]
    if (v > 1 || v < -1) clipped++
    v = Math.max(-1, Math.min(1, v))
    b.writeInt16LE(Math.round(v * 32767), 44 + i * 2)
  }
  writeFileSync(path, b)
  return clipped
}

mkdirSync(OUT, { recursive: true })

// BGM 2회 루프
const loopS = TOTAL_STEPS * STEP_S
const bgm = new Float32Array(Math.ceil((loopS * 2 + 0.5) * SR))
for (let rep = 0; rep < 2; rep++) {
  const base = rep * loopS
  for (const [s, f, len] of MELODY) addTone(bgm, base + s * STEP_S, len * STEP_S * 0.92, 'square', f, 0.085)
  for (const [s, f, len] of BASS) addTone(bgm, base + s * STEP_S, len * STEP_S * 0.95, 'triangle', f, 0.1)
  for (const s of KICK) addNoise(bgm, base + s * STEP_S, 0.07, 0.16, 'thud')
  for (const s of HAT) addNoise(bgm, base + s * STEP_S, 0.035, 0.05, 'hat')
}
const c1 = writeWav(join(OUT, 'bgm.wav'), bgm)
console.log(`bgm.wav   ${(bgm.length / SR).toFixed(2)}초 (루프 ${loopS.toFixed(2)}초 x2), 클리핑 ${c1}샘플`)

// 효과음 전부 순서대로
const order = ['select', 'jump', 'coin', 'stomp', 'bump', 'brick', 'powerup', 'fire', 'hurt', 'extraLife', 'die', 'goal']
const sfx = new Float32Array(Math.ceil(30 * SR))
let cursor = 0.2
const marks = []
for (const k of order) {
  marks.push(`${cursor.toFixed(2)}s ${k}`)
  const dur = renderSfx(sfx, SFX[k], cursor)
  cursor += dur + 0.45
}
const trimmed = sfx.slice(0, Math.ceil((cursor + 0.3) * SR))
const c2 = writeWav(join(OUT, 'sfx.wav'), trimmed)
console.log(`sfx.wav   ${(trimmed.length / SR).toFixed(2)}초, 클리핑 ${c2}샘플`)
console.log('순서:', marks.join(' · '))
