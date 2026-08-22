import type {
  BossPhase, BossShape, BossSpec, EnemyKind, GunSpec, PathSpec, SkyStage, WaveSpec,
} from './types'

/**
 * 10탄 타임라인.
 *
 * 좌표를 손으로 쓰지 않고 헬퍼로 만든다. 텐가이처럼 짧은 편대가 쉼 없이
 * 밀려오다 보스로 끝나는 구성이다. 앞 탄은 탄속을 느리게 잡았다 —
 * 처음 잡는 아이가 피할 수 있어야 한다.
 */

// ── 경로 ──────────────────────────────────────────────────────
const straight = (speed: number): PathSpec => ({ kind: 'straight', speed })
const sine = (speed: number, amp = 18, hz = 0.7): PathSpec =>
  ({ kind: 'sine', speed, amp, hz })
const hover = (speed: number, holdX: number, holdMs: number): PathSpec =>
  ({ kind: 'hover', speed, holdX, holdMs })
const swoop = (speed: number, amp = 50, hz = 0.26): PathSpec =>
  ({ kind: 'swoop', speed, amp, hz })
const anchor = (): PathSpec => ({ kind: 'anchor', speed: 0 })

// ── 총 ────────────────────────────────────────────────────────
type Ex = Partial<GunSpec>
const aimed = (everyMs: number, speed: number, count = 1, ex: Ex = {}): GunSpec =>
  ({ pattern: 'aimed', everyMs, speed, count, ...ex })
const spread = (everyMs: number, speed: number, count = 3, arc = 0.7, ex: Ex = {}): GunSpec =>
  ({ pattern: 'spread', everyMs, speed, count, arc, ...ex })
const ring = (everyMs: number, speed: number, count = 8, ex: Ex = {}): GunSpec =>
  ({ pattern: 'ring', everyMs, speed, count, ...ex })
const spiral = (everyMs: number, speed: number, count = 2, spin = 0.42, ex: Ex = {}): GunSpec =>
  ({ pattern: 'spiral', everyMs, speed, count, spin, ...ex })
const homing = (everyMs: number, speed: number, count = 1, ex: Ex = {}): GunSpec =>
  ({ pattern: 'homing', everyMs, speed, count, turn: 2.2, turnMs: 2200, ...ex })
const wavey = (everyMs: number, speed: number, count = 2, ex: Ex = {}): GunSpec =>
  ({ pattern: 'wave', everyMs, speed, count, amp: 15, hz: 1.3, ...ex })
const burst = (everyMs: number, speed: number, ex: Ex = {}): GunSpec =>
  ({ pattern: 'burst', everyMs, speed, count: 1, burstAt: 850, burstN: 8, ...ex })
const rain = (everyMs: number, speed: number, count = 5, ex: Ex = {}): GunSpec =>
  ({ pattern: 'rain', everyMs, speed, count, ...ex })
const arcgun = (everyMs: number, speed: number, count = 5, arc = 1.1, ex: Ex = {}): GunSpec =>
  ({ pattern: 'arc', everyMs, speed, count, arc, ...ex })
const laser = (everyMs: number, ex: Ex = {}): GunSpec =>
  ({ pattern: 'laser', everyMs, warnMs: 700, life: 800, ...ex })

// ── 편대 ──────────────────────────────────────────────────────
type WaveOpt = {
  count?: number
  gap?: number
  dy?: number
  hp?: number
  drop?: WaveSpec['drop']
}

function w(
  atMs: number,
  kind: EnemyKind,
  y: number,
  path: PathSpec,
  guns: GunSpec[],
  o: WaveOpt = {},
): WaveSpec {
  return {
    atMs,
    kind,
    y,
    path,
    guns,
    count: o.count ?? 4,
    gapMs: o.gap ?? 260,
    dy: o.dy ?? 0,
    hp: o.hp,
    drop: o.drop ?? null,
  }
}

// ── 보스 ──────────────────────────────────────────────────────
function shape(
  body: BossShape['body'], main: string, sub: string, eye: string, arms = 2,
): BossShape {
  return { body, main, sub, eye, arms }
}

/**
 * 보스 페이즈 하나.
 *
 * 체력 숫자는 "초당 피해 × 원하는 초"로 잡았다. 파워 3단계(초당 168) 기준
 * 1탄 보스가 20초 안팎, 10탄 보스가 40초 안팎이 되게 맞췄다.
 */
function phase(
  hp: number, move: BossPhase['move'], sh: BossShape, guns: GunSpec[],
): BossPhase {
  return { hp, move, shape: sh, guns }
}

function boss(name: string, wpx: number, h: number, phases: BossPhase[]): BossSpec {
  return { name, w: wpx, h, phases }
}

// ── 1탄 · 아침 들판 ───────────────────────────────────────────
const S1: SkyStage = {
  id: 'sky-01',
  name: '아침 들판',
  theme: 'dawn',
  waves: [
    w(600, 'bird', 0.3, sine(80), [], { count: 4, dy: 0.06 }),
    w(3200, 'bird', 0.7, sine(80), [], { count: 4, dy: -0.06, drop: 'power' }),
    w(6400, 'bird', 0.45, sine(86, 22), [aimed(1700, 82)], { count: 5 }),
    w(10_500, 'bee', 0.25, swoop(94), [aimed(1500, 88)], { count: 3, gap: 420 }),
    w(14_500, 'bird', 0.8, sine(88), [aimed(1600, 85)], { count: 5, dy: -0.08, drop: 'coin' }),
    w(19_000, 'kite', 0.5, hover(70, 300, 2400), [spread(1500, 78, 3, 0.6)], { count: 2, gap: 900 }),
    w(24_000, 'bee', 0.6, swoop(96, -46), [aimed(1400, 92)], { count: 4, gap: 380 }),
    w(29_000, 'bird', 0.35, sine(92, 26), [aimed(1400, 90)], { count: 6, gap: 220, drop: 'power' }),
    w(35_000, 'kite', 0.3, hover(72, 290, 2600), [spread(1300, 82, 3, 0.7)], { count: 2, gap: 800, dy: 0.4 }),
    w(41_000, 'bee', 0.5, swoop(100), [aimed(1200, 95, 2)], { count: 5, gap: 320, drop: 'bomb' }),
  ],
  boss: boss('왕눈이 새', 46, 40, [
    phase(410, 'hover', shape('bird', '#e8a13c', '#b8701f', '#fff8e0'), [
      aimed(1300, 95, 2, { oy: -6 }),
      spread(2100, 82, 3, 0.8, { oy: 8 }),
    ]),
    phase(480, 'sweep', shape('bird', '#e05c4a', '#992f2a', '#ffe9c0', 3), [
      aimed(950, 105, 3),
      ring(2600, 72, 8, { hue: 'amber' }),
    ]),
  ]),
}

// ── 2탄 · 구름 바다 ───────────────────────────────────────────
const S2: SkyStage = {
  id: 'sky-02',
  name: '구름 바다',
  theme: 'cloud',
  waves: [
    w(600, 'bee', 0.3, swoop(100), [aimed(1400, 95)], { count: 4, gap: 300 }),
    w(4200, 'bird', 0.65, sine(94, 24), [aimed(1400, 92)], { count: 5, dy: -0.05 }),
    w(8200, 'kite', 0.25, hover(74, 300, 2400), [spread(1200, 88, 3, 0.75)], { count: 2, gap: 800, dy: 0.5, drop: 'power' }),
    w(12_800, 'ufo', 0.5, hover(66, 320, 3000), [ring(2000, 74, 8)], { count: 1 }),
    w(16_500, 'bee', 0.7, swoop(104, -50), [aimed(1200, 98, 2)], { count: 5, gap: 280 }),
    w(21_000, 'bird', 0.4, sine(98, 28), [wavey(1900, 82, 2)], { count: 6, gap: 220, drop: 'coin' }),
    w(26_500, 'kite', 0.55, hover(76, 280, 2600), [spread(1100, 92, 4, 0.9)], { count: 3, gap: 700 }),
    w(32_000, 'ufo', 0.3, hover(68, 300, 2800), [ring(1800, 78, 10)], { count: 2, gap: 1400, dy: 0.4, drop: 'power' }),
    w(38_500, 'bee', 0.5, swoop(108), [aimed(1000, 105, 2)], { count: 6, gap: 260 }),
    w(44_000, 'blimp', 0.5, hover(46, 300, 5200), [spread(1300, 88, 3, 0.8, { oy: -8 }), wavey(1700, 84, 2, { oy: 8 })], { count: 1, drop: 'bomb' }),
  ],
  boss: boss('구름고래', 58, 38, [
    phase(490, 'hover', shape('whale', '#5f96d0', '#254e84', '#ffffff'), [
      wavey(1200, 92, 3, { oy: -4 }),
      aimed(1600, 100, 2, { oy: 10 }),
    ]),
    phase(570, 'sweep', shape('whale', '#5f8fd6', '#2d5a94', '#e8f4ff', 3), [
      rain(1500, 96, 5),
      spread(1400, 95, 5, 1.0),
    ]),
  ]),
}

// ── 3탄 · 숲 위 ───────────────────────────────────────────────
const S3: SkyStage = {
  id: 'sky-03',
  name: '숲 위',
  theme: 'forest',
  waves: [
    w(600, 'bird', 0.3, sine(100, 26), [aimed(1300, 98)], { count: 5, dy: 0.05 }),
    w(4600, 'turret', 0, anchor(), [aimed(1500, 100, 2)], { count: 3, gap: 1600 }),
    w(9000, 'bee', 0.35, swoop(108), [aimed(1100, 104)], { count: 5, gap: 260, drop: 'power' }),
    w(13_800, 'kite', 0.6, hover(78, 290, 2400), [spread(1000, 96, 4, 0.9)], { count: 3, gap: 620 }),
    w(19_000, 'turret', 0, anchor(), [spread(1700, 92, 3, 0.55)], { count: 4, gap: 1300, drop: 'coin' }),
    w(24_500, 'rocket', 0.4, straight(120), [homing(1600, 78)], { count: 4, gap: 420, dy: 0.12 }),
    w(29_500, 'bird', 0.7, sine(104, 30), [wavey(1600, 90, 2)], { count: 6, gap: 210 }),
    w(35_000, 'ufo', 0.4, hover(70, 300, 3000), [ring(1600, 82, 10), aimed(1900, 105)], { count: 2, gap: 1500, dy: 0.3, drop: 'power' }),
    w(41_500, 'rocket', 0.6, straight(126), [homing(1400, 84)], { count: 5, gap: 360 }),
    w(47_000, 'blimp', 0.35, hover(48, 290, 5000), [arcgun(1300, 92, 5, 1.0), aimed(1500, 108, 2)], { count: 1, drop: 'bomb' }),
  ],
  boss: boss('나무 골렘', 54, 46, [
    phase(670, 'hover', shape('golem', '#6aa84f', '#38601f', '#ffe66b'), [
      spread(1200, 98, 4, 0.9, { oy: -8 }),
      burst(2600, 88, { oy: 6 }),
    ]),
    phase(800, 'charge', shape('golem', '#8d6e3a', '#4a3517', '#ffb347', 4), [
      aimed(850, 112, 3),
      ring(2200, 84, 12, { hue: 'lime' }),
    ]),
  ]),
}

// ── 4탄 · 폭풍 ────────────────────────────────────────────────
const S4: SkyStage = {
  id: 'sky-04',
  name: '폭풍 속',
  theme: 'storm',
  waves: [
    w(600, 'rocket', 0.3, straight(126), [homing(1500, 84)], { count: 4, gap: 400, dy: 0.14 }),
    w(5000, 'bee', 0.6, swoop(112), [aimed(1000, 110, 2)], { count: 5, gap: 250 }),
    w(9800, 'ufo', 0.45, hover(70, 310, 2800), [rain(1500, 100, 4)], { count: 2, gap: 1300, drop: 'power' }),
    w(15_000, 'kite', 0.25, hover(80, 280, 2400), [spread(950, 100, 4, 1.0)], { count: 3, gap: 600, dy: 0.45 }),
    w(20_500, 'turret', 0, anchor(), [laser(3000)], { count: 3, gap: 1800 }),
    w(26_000, 'rocket', 0.5, straight(132), [homing(1300, 88, 2, { turn: 2.6 })], { count: 5, gap: 340, drop: 'coin' }),
    w(31_500, 'bird', 0.35, sine(110, 32), [wavey(1400, 96, 3)], { count: 7, gap: 200 }),
    w(37_500, 'ufo', 0.55, hover(72, 300, 3000), [ring(1400, 90, 12), rain(1900, 104, 4)], { count: 2, gap: 1400, dy: -0.3, drop: 'power' }),
    w(44_000, 'blimp', 0.5, hover(50, 300, 5200), [arcgun(1100, 98, 6, 1.2), homing(2000, 86)], { count: 1 }),
    w(50_000, 'bee', 0.4, swoop(116), [aimed(900, 116, 2)], { count: 7, gap: 220, drop: 'bomb' }),
  ],
  boss: boss('번개 새', 50, 42, [
    phase(670, 'sweep', shape('bird', '#9ad8f0', '#3c7fa8', '#fff6a8', 3), [
      laser(2600, { big: true }),
      aimed(1000, 118, 2),
    ]),
    phase(790, 'circle', shape('bird', '#c8a0ff', '#6c3fa8', '#fff6a8', 4), [
      homing(1300, 92, 3, { turn: 2.8 }),
      spread(1200, 106, 5, 1.1),
    ]),
  ]),
}

// ── 5탄 · 불의 산 ─────────────────────────────────────────────
const S5: SkyStage = {
  id: 'sky-05',
  name: '불의 산',
  theme: 'volcano',
  waves: [
    w(600, 'bee', 0.35, swoop(116), [aimed(950, 114, 2)], { count: 6, gap: 240 }),
    w(5200, 'turret', 0, anchor(), [burst(2400, 92)], { count: 4, gap: 1400 }),
    w(10_500, 'ufo', 0.4, hover(72, 300, 2800), [ring(1300, 92, 12)], { count: 2, gap: 1200, drop: 'power' }),
    w(16_000, 'rocket', 0.55, straight(136), [homing(1200, 92, 2, { turn: 2.7 })], { count: 6, gap: 320 }),
    w(21_500, 'kite', 0.3, hover(82, 280, 2400), [arcgun(1200, 100, 5, 1.1)], { count: 3, gap: 580, dy: 0.4 }),
    w(27_000, 'bird', 0.6, sine(114, 34), [wavey(1300, 100, 3)], { count: 7, gap: 190, drop: 'coin' }),
    w(33_000, 'ufo', 0.5, hover(74, 310, 3200), [spiral(420, 88, 2, 0.5)], { count: 2, gap: 1600, dy: -0.28, drop: 'power' }),
    w(39_500, 'turret', 0, anchor(), [laser(2800), aimed(1600, 112)], { count: 4, gap: 1300 }),
    w(46_000, 'blimp', 0.4, hover(52, 290, 5400), [burst(1800, 94), spread(1100, 104, 5, 1.1)], { count: 1, drop: 'bomb' }),
    w(53_000, 'bee', 0.5, swoop(120), [aimed(850, 120, 3)], { count: 7, gap: 210 }),
  ],
  boss: boss('불도마뱀', 62, 44, [
    phase(480, 'hover', shape('lizard', '#f07a30', '#a8380f', '#ffe66b'), [
      burst(1900, 96, { oy: -6 }),
      aimed(950, 118, 2, { oy: 8 }),
    ]),
    phase(570, 'charge', shape('lizard', '#e8452c', '#8c1f14', '#ffd166', 3), [
      arcgun(1000, 104, 6, 1.2),
      homing(1800, 92, 2),
    ]),
    phase(650, 'sweep', shape('lizard', '#ffca3a', '#c46b00', '#fff8e0', 4), [
      spiral(300, 96, 3, 0.55),
      spread(1400, 112, 5, 1.2),
    ]),
  ]),
}

// ── 6탄 · 밤하늘 ──────────────────────────────────────────────
const S6: SkyStage = {
  id: 'sky-06',
  name: '밤하늘',
  theme: 'night',
  waves: [
    w(600, 'bird', 0.3, sine(116, 30), [aimed(1100, 112, 2)], { count: 6, gap: 200 }),
    w(5000, 'ufo', 0.5, hover(74, 300, 2800), [spiral(400, 90, 2, 0.48)], { count: 2, gap: 1400, drop: 'power' }),
    w(10_800, 'rocket', 0.35, straight(138), [homing(1100, 94, 2, { turn: 2.9 })], { count: 6, gap: 300 }),
    w(16_200, 'kite', 0.65, hover(84, 280, 2400), [ring(1400, 92, 10)], { count: 3, gap: 560 }),
    w(21_800, 'bee', 0.45, swoop(122), [aimed(820, 122, 2)], { count: 7, gap: 200, drop: 'coin' }),
    w(27_500, 'turret', 0, anchor(), [spiral(500, 92, 2, 0.6)], { count: 4, gap: 1300 }),
    w(33_500, 'ufo', 0.3, hover(76, 310, 3000), [ring(1200, 96, 14), aimed(1500, 118)], { count: 2, gap: 1500, dy: 0.42, drop: 'power' }),
    w(40_000, 'bird', 0.55, sine(120, 36), [wavey(1200, 104, 3)], { count: 8, gap: 180 }),
    w(46_500, 'blimp', 0.5, hover(54, 290, 5400), [spiral(340, 94, 3, 0.52), homing(1900, 94)], { count: 1, drop: 'bomb' }),
    w(53_500, 'rocket', 0.6, straight(142), [homing(1000, 98, 2, { turn: 3.0 })], { count: 7, gap: 280 }),
  ],
  boss: boss('달 광대', 48, 48, [
    phase(580, 'circle', shape('orb', '#cfd8ff', '#5661a8', '#ffe66b'), [
      spiral(280, 94, 3, 0.5),
      aimed(1200, 118, 2),
    ]),
    phase(660, 'hover', shape('orb', '#ffd166', '#b07a1f', '#3a2a10', 4), [
      ring(1100, 96, 16),
      homing(1500, 96, 3, { turn: 2.9 }),
    ]),
    phase(730, 'sweep', shape('orb', '#ff7ab8', '#a8306a', '#fff1f8', 5), [
      spiral(240, 100, 4, 0.62),
      spread(1200, 118, 5, 1.2),
    ]),
  ]),
}

// ── 7탄 · 얼음 골짜기 ─────────────────────────────────────────
const S7: SkyStage = {
  id: 'sky-07',
  name: '얼음 골짜기',
  theme: 'ice',
  waves: [
    w(600, 'kite', 0.3, hover(86, 290, 2200), [spread(900, 106, 5, 1.1)], { count: 3, gap: 520, dy: 0.4 }),
    w(6000, 'bird', 0.6, sine(122, 34), [wavey(1100, 106, 3)], { count: 7, gap: 190, drop: 'power' }),
    w(12_000, 'turret', 0, anchor(), [laser(2400, { big: true })], { count: 4, gap: 1300 }),
    w(18_000, 'ufo', 0.45, hover(76, 300, 2800), [ring(1100, 100, 14)], { count: 2, gap: 1400 }),
    w(23_800, 'rocket', 0.35, straight(144), [homing(950, 100, 2, { turn: 3.1 })], { count: 7, gap: 270, drop: 'coin' }),
    w(30_000, 'bee', 0.55, swoop(126), [aimed(780, 126, 3)], { count: 7, gap: 190 }),
    w(36_000, 'kite', 0.7, hover(88, 280, 2400), [arcgun(950, 108, 6, 1.2)], { count: 4, gap: 520, drop: 'power' }),
    w(42_500, 'ufo', 0.4, hover(78, 310, 3200), [spiral(260, 98, 3, 0.55), aimed(1400, 122)], { count: 2, gap: 1500, dy: 0.35 }),
    w(49_500, 'blimp', 0.5, hover(56, 290, 5600), [laser(2600, { big: true }), spread(1000, 112, 5, 1.2)], { count: 1, drop: 'bomb' }),
    w(56_500, 'bird', 0.35, sine(126, 38), [wavey(1000, 110, 3)], { count: 8, gap: 170 }),
  ],
  boss: boss('얼음 여왕', 52, 50, [
    phase(660, 'hover', shape('crown', '#4fa8d8', '#14486e', '#eaffff'), [
      laser(2400, { big: true }),
      spread(1100, 112, 5, 1.1),
    ]),
    phase(750, 'sweep', shape('crown', '#7fc8e8', '#2a5f88', '#0e3450', 4), [
      ring(1000, 100, 16),
      wavey(1100, 108, 4),
    ]),
    phase(850, 'circle', shape('crown', '#b8a0ff', '#5a3fa8', '#e8f4ff', 5), [
      spiral(230, 102, 4, 0.6),
      homing(1400, 100, 3, { turn: 3.0 }),
    ]),
  ]),
}

// ── 8탄 · 모래 폭풍 ───────────────────────────────────────────
const S8: SkyStage = {
  id: 'sky-08',
  name: '모래 폭풍',
  theme: 'desert',
  waves: [
    w(600, 'bee', 0.4, swoop(128), [aimed(760, 128, 3)], { count: 7, gap: 180 }),
    w(6200, 'turret', 0, anchor(), [arcgun(1100, 106, 6, 1.2)], { count: 4, gap: 1200, drop: 'power' }),
    w(12_500, 'rocket', 0.5, straight(148), [homing(900, 104, 2, { turn: 3.2 })], { count: 7, gap: 260 }),
    w(18_500, 'ufo', 0.35, hover(78, 300, 2800), [rain(1100, 112, 6)], { count: 2, gap: 1300 }),
    w(24_500, 'kite', 0.6, hover(90, 280, 2200), [spread(880, 112, 5, 1.2)], { count: 4, gap: 500, drop: 'coin' }),
    w(31_000, 'bird', 0.3, sine(128, 38), [wavey(980, 112, 3)], { count: 8, gap: 170 }),
    w(37_500, 'blimp', 0.35, hover(56, 300, 5200), [burst(1500, 100), arcgun(1000, 110, 6, 1.3)], { count: 1, drop: 'power' }),
    w(44_500, 'ufo', 0.55, hover(80, 310, 3200), [spiral(220, 102, 3, 0.58), ring(1400, 104, 14)], { count: 2, gap: 1400, dy: -0.3 }),
    w(51_500, 'turret', 0, anchor(), [laser(2200, { big: true }), aimed(1300, 124, 2)], { count: 4, gap: 1200 }),
    w(58_500, 'bee', 0.5, swoop(132), [aimed(720, 132, 3)], { count: 8, gap: 170, drop: 'bomb' }),
  ],
  boss: boss('모래 전갈', 64, 44, [
    phase(710, 'charge', shape('lizard', '#e0b878', '#9a7132', '#3a2a10'), [
      arcgun(900, 112, 6, 1.3),
      aimed(820, 128, 3),
    ]),
    phase(800, 'sweep', shape('lizard', '#c88a3a', '#7a4a12', '#ffd166', 4), [
      burst(1400, 104, { burstN: 12 }),
      homing(1300, 104, 3, { turn: 3.1 }),
    ]),
    phase(900, 'circle', shape('lizard', '#8c5a2a', '#4a2a08', '#ff7a4a', 5), [
      spiral(210, 106, 4, 0.64),
      spread(1000, 124, 7, 1.4),
    ]),
  ]),
}

// ── 9탄 · 증기 요새 ───────────────────────────────────────────
const S9: SkyStage = {
  id: 'sky-09',
  name: '증기 요새',
  theme: 'steam',
  waves: [
    w(600, 'turret', 0, anchor(), [spread(900, 112, 5, 1.1)], { count: 5, gap: 1100 }),
    w(6800, 'rocket', 0.3, straight(152), [homing(850, 108, 2, { turn: 3.3 })], { count: 8, gap: 240, drop: 'power' }),
    w(13_500, 'ufo', 0.5, hover(80, 300, 2800), [ring(950, 106, 16)], { count: 3, gap: 1200 }),
    w(20_500, 'kite', 0.35, hover(92, 280, 2200), [arcgun(880, 114, 6, 1.3)], { count: 4, gap: 480 }),
    w(27_000, 'blimp', 0.55, hover(58, 300, 5200), [laser(2200, { big: true }), burst(1500, 104)], { count: 1, drop: 'coin' }),
    w(34_000, 'bee', 0.45, swoop(134), [aimed(700, 134, 3)], { count: 8, gap: 165 }),
    w(40_500, 'turret', 0, anchor(), [spiral(230, 104, 3, 0.6)], { count: 5, gap: 1100, drop: 'power' }),
    w(47_500, 'ufo', 0.3, hover(82, 310, 3200), [rain(950, 118, 6), aimed(1200, 130, 2)], { count: 3, gap: 1300, dy: 0.35 }),
    w(55_000, 'rocket', 0.6, straight(156), [homing(800, 112, 3, { turn: 3.3 })], { count: 8, gap: 230 }),
    w(62_000, 'blimp', 0.4, hover(58, 290, 5600), [spiral(200, 108, 4, 0.62), spread(950, 126, 7, 1.4)], { count: 1, drop: 'bomb' }),
  ],
  boss: boss('증기 기계병', 66, 52, [
    phase(810, 'hover', shape('machine', '#b8bcc4', '#5a5f68', '#ff5a3c', 4), [
      laser(2000, { big: true }),
      spread(900, 122, 6, 1.2),
    ]),
    phase(930, 'charge', shape('machine', '#8c9098', '#3c4048', '#ffb347', 5), [
      burst(1300, 108, { burstN: 12 }),
      arcgun(880, 118, 7, 1.4),
    ]),
    phase(1050, 'sweep', shape('machine', '#d8a03c', '#8a5a10', '#fff1c0', 6), [
      spiral(190, 110, 4, 0.66),
      homing(1200, 108, 3, { turn: 3.2 }),
      ring(1600, 108, 18),
    ]),
  ]),
}

// ── 10탄 · 천공성 ─────────────────────────────────────────────
const S10: SkyStage = {
  id: 'sky-10',
  name: '천공성',
  theme: 'castle',
  waves: [
    w(600, 'bee', 0.4, swoop(136), [aimed(680, 136, 3)], { count: 8, gap: 160 }),
    w(6500, 'turret', 0, anchor(), [laser(2000, { big: true })], { count: 5, gap: 1000, drop: 'power' }),
    w(13_000, 'ufo', 0.45, hover(82, 300, 2800), [ring(900, 110, 18)], { count: 3, gap: 1100 }),
    w(20_000, 'rocket', 0.35, straight(158), [homing(780, 114, 3, { turn: 3.4 })], { count: 8, gap: 220 }),
    w(26_500, 'kite', 0.65, hover(94, 280, 2200), [arcgun(850, 120, 7, 1.4)], { count: 4, gap: 460, drop: 'coin' }),
    w(33_000, 'blimp', 0.3, hover(58, 300, 5200), [burst(1200, 110, { burstN: 12 }), spread(900, 126, 6, 1.3)], { count: 1, drop: 'power' }),
    w(40_500, 'ufo', 0.55, hover(84, 310, 3200), [spiral(180, 112, 4, 0.64), rain(1100, 122, 6)], { count: 3, gap: 1200, dy: -0.28 }),
    w(48_500, 'bird', 0.4, sine(134, 40), [wavey(900, 118, 4)], { count: 9, gap: 155 }),
    w(55_500, 'turret', 0, anchor(), [spiral(190, 110, 3, 0.62), aimed(1100, 134, 2)], { count: 5, gap: 1000 }),
    w(63_000, 'blimp', 0.5, hover(58, 290, 5600), [laser(1900, { big: true }), homing(1100, 112, 3)], { count: 1, drop: 'bomb' }),
  ],
  boss: boss('천공왕', 72, 58, [
    phase(1040, 'hover', shape('crown', '#ffd166', '#a8761f', '#3a2a10', 4), [
      spread(850, 126, 7, 1.3),
      laser(2200, { big: true }),
      aimed(900, 138, 3),
    ]),
    phase(1190, 'circle', shape('crown', '#ff7a4a', '#a8320f', '#fff1c0', 5), [
      spiral(170, 112, 4, 0.66),
      burst(1300, 112, { burstN: 14 }),
      homing(1300, 112, 3, { turn: 3.3 }),
    ]),
    phase(1410, 'sweep', shape('crown', '#c8a0ff', '#5a2fa8', '#fff8e0', 6), [
      ring(850, 112, 20),
      arcgun(800, 124, 7, 1.5),
      homing(1100, 116, 4, { turn: 3.5 }),
      laser(2600, { big: true }),
    ]),
  ]),
}

export const SKY_STAGES: readonly SkyStage[] = [S1, S2, S3, S4, S5, S6, S7, S8, S9, S10]

export function skyStageAt(i: number): SkyStage {
  return SKY_STAGES[Math.max(0, Math.min(SKY_STAGES.length - 1, i))]!
}

export function skyStageIndex(id: string): number {
  return SKY_STAGES.findIndex((s) => s.id === id)
}

/** 마지막 편대가 끝나는 시각. 이 뒤에 보스가 나온다 */
export function wavesEndMs(s: SkyStage): number {
  let end = 0
  for (const wv of s.waves) {
    const last = wv.atMs + wv.gapMs * Math.max(0, wv.count - 1)
    if (last > end) end = last
  }
  // 마지막 편대가 화면을 가로지를 시간을 얹는다
  return end + 4200
}
