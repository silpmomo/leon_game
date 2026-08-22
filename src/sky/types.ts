/** 리온의 하늘전투 — 상태 타입 전부. DOM 을 모른다. */

export type SkyScene = 'title' | 'select' | 'playing' | 'dead' | 'clear' | 'gameover'

export type SkyMode = 'practice' | 'challenge'

export type SkyTheme =
  | 'dawn' | 'cloud' | 'forest' | 'storm' | 'volcano'
  | 'night' | 'ice' | 'desert' | 'steam' | 'castle'

// ── 탄 ────────────────────────────────────────────────────────

/**
 * 적탄. 종류를 필드로 두지 않고 동작 파라미터로 둔다 —
 * "유도하면서 사인파를 그리는 탄" 같은 조합을 새 종류 없이 만들 수 있다.
 */
export type EBullet = {
  x: number
  y: number
  vx: number
  vy: number
  /** 판정 반지름 */
  r: number
  /** 산 시간(ms) */
  age: number
  /** 수명(ms). 넘으면 사라진다 */
  life: number
  /** 유도 세기(rad/s). 0이면 직진 */
  turn: number
  /** 유도를 멈추는 시각(ms). 끝없이 쫓아오면 피할 수 없다 */
  turnUntil: number
  /** 사인파 진폭(px). 0이면 안 흔들린다 */
  waveAmp: number
  /** 사인파 주기(Hz) */
  waveHz: number
  /** 사인파의 기준 진행 방향(rad) */
  baseAngle: number
  /** 분열 시각(ms). 0이면 안 터진다 */
  burstAt: number
  /** 분열 시 갈래 수 */
  burstN: number
  /** 분열 탄 속도 */
  burstSpeed: number
  /** 색 계열 */
  hue: BulletHue
  /** 그릴 때 크기 배수 */
  big: boolean
}

export type BulletHue = 'pink' | 'blue' | 'amber' | 'violet' | 'lime'

/** 예고선을 먼저 보여주고 쏘는 광역 빔 */
export type Beam = {
  x: number
  y: number
  /** 진행 방향 */
  angle: number
  /** 반두께 */
  half: number
  age: number
  /** 예고 시간(ms) */
  warnMs: number
  /** 발사 시간(ms) */
  fireMs: number
  hue: BulletHue
}

// ── 플레이어 ──────────────────────────────────────────────────

export type Shot = {
  x: number
  y: number
  vx: number
  vy: number
  dmg: number
  /** 유도 미사일이면 true */
  homing: boolean
  age: number
  r: number
}

export type Option = {
  x: number
  y: number
  /** 본체 기준 목표 오프셋 */
  oy: number
  cool: number
}

export type SkyPlayer = {
  x: number
  y: number
  /** 0..3 → 샷 레벨 1..4 */
  power: number
  bombs: number
  /** 무적 잔여(ms) */
  invMs: number
  /** 접촉 경직 잔여(ms) — 이 동안 조작이 둔해진다 */
  stunMs: number
  /** 다음 발사까지(ms) */
  cool: number
  /** 지금까지 쏜 횟수. 미사일을 몇 발에 한 번 낼지 정하는 데 쓴다 */
  shotN: number
  /** 그림 기울기용. 최근 세로 이동량 */
  tilt: number
  alive: boolean
}

// ── 적 ────────────────────────────────────────────────────────

export type EnemyKind =
  | 'bird' | 'bee' | 'kite' | 'ufo' | 'rocket' | 'turret' | 'blimp'

export type PathKind =
  /** 왼쪽으로 직진 */
  | 'straight'
  /** 직진 + 세로 사인 */
  | 'sine'
  /** 들어와서 멈췄다가 되돌아 나간다 */
  | 'hover'
  /** 크게 호를 그리며 훑고 지나간다 */
  | 'swoop'
  /** 배경에 붙어 함께 흐른다 (포탑) */
  | 'anchor'

export type PathSpec = {
  kind: PathKind
  /** 기본 진행 속도(px/s). 왼쪽이 양수 */
  speed: number
  /** sine 진폭(px) */
  amp?: number
  /** sine 주기(Hz) */
  hz?: number
  /** hover 가 멈춰 서는 x */
  holdX?: number
  /** hover 정지 시간(ms) */
  holdMs?: number
}

export type Pattern =
  | 'aimed' | 'spread' | 'ring' | 'spiral'
  | 'homing' | 'wave' | 'burst' | 'rain' | 'arc' | 'laser'

/** 적·보스가 공유하는 발사 스크립트 한 줄 */
export type GunSpec = {
  pattern: Pattern
  /** 발사 간격(ms) */
  everyMs: number
  /** 최초 발사까지 지연(ms) */
  delayMs?: number
  /** laser 전용 — 예고선을 보여주는 시간(ms) */
  warnMs?: number
  /** 한 번에 나가는 갈래 수 */
  count?: number
  /** 탄속(px/s) */
  speed?: number
  /** spread·arc 의 부채꼴 폭(rad) */
  arc?: number
  /** spiral 한 발마다 돌아가는 각(rad) */
  spin?: number
  /** ring 의 시작 각(rad) */
  phase?: number
  /** 총구 위치 (적 중심 기준) */
  ox?: number
  oy?: number
  /** 유도 세기(rad/s) */
  turn?: number
  /** 유도 지속(ms) */
  turnMs?: number
  /** 탄 수명(ms) */
  life?: number
  /** burst 분열 시각(ms) */
  burstAt?: number
  /** burst 분열 갈래 */
  burstN?: number
  /** 연사: 이만큼 연달아 쏘고 */
  burstShots?: number
  /** 그다음 이만큼 쉰다(ms) */
  restMs?: number
  hue?: BulletHue
  /** 큰 탄 */
  big?: boolean
  /** wave 진폭 */
  amp?: number
  /** wave 주기(Hz) */
  hz?: number
}

export type DropKind = 'power' | 'bomb' | 'coin' | null

export type SkyEnemy = {
  kind: EnemyKind
  x: number
  y: number
  /** 등장 위치. sine·swoop 의 기준선 */
  y0: number
  w: number
  h: number
  hp: number
  maxHp: number
  t: number
  path: PathSpec
  guns: GunSpec[]
  /** 총별 남은 시간과 발사 횟수 */
  gunT: number[]
  gunN: number[]
  /** 피격 플래시 잔여(ms) */
  hitMs: number
  alive: boolean
  drop: DropKind
  score: number
  /** 편대 안에서의 순번. 패턴 위상차에 쓴다 */
  idx: number
}

// ── 보스 ──────────────────────────────────────────────────────

/** 보스는 도트가 아니라 이 파라미터로 그린다 */
export type BossShape = {
  /** 몸통 형태 */
  body: 'orb' | 'bird' | 'whale' | 'golem' | 'lizard' | 'crown' | 'machine'
  /** 주 색 */
  main: string
  /** 보조 색 */
  sub: string
  /** 눈 색 */
  eye: string
  /** 장식 팔·날개 개수 */
  arms: number
}

export type BossPhase = {
  hp: number
  /** 이 페이즈의 이동 */
  move: 'hover' | 'sweep' | 'charge' | 'circle'
  guns: GunSpec[]
  shape: BossShape
}

export type SkyBoss = {
  name: string
  x: number
  y: number
  w: number
  h: number
  hp: number
  phase: number
  phases: BossPhase[]
  t: number
  gunT: number[]
  gunN: number[]
  hitMs: number
  /** 등장 연출 잔여(ms). 이 동안 무적이고 안 쏜다 */
  enterMs: number
  /** 페이즈 전환 연출 잔여(ms) */
  morphMs: number
  /** 격파 연출 잔여(ms) */
  dieMs: number
  alive: boolean
  /** sweep 방향 */
  dir: number
}

export type BossSpec = {
  name: string
  w: number
  h: number
  phases: BossPhase[]
}

// ── 아이템 ────────────────────────────────────────────────────

export type SkyItem = {
  kind: Exclude<DropKind, null>
  x: number
  y: number
  vx: number
  vy: number
  /** 코인 값은 시간이 지나면 떨어진다 */
  age: number
}

// ── 연출 ──────────────────────────────────────────────────────

export type Burst = {
  x: number
  y: number
  age: number
  life: number
  r: number
  hue: BulletHue | 'white'
}

// ── 스테이지 ──────────────────────────────────────────────────

export type WaveSpec = {
  /** 스테이지 시작 후 이 시각에 등장(ms) */
  atMs: number
  kind: EnemyKind
  /** 편대 수 */
  count: number
  /** 편대 안 등장 간격(ms) */
  gapMs: number
  /** 세로 위치 (0..1 비율) */
  y: number
  /** 편대마다 더해지는 세로 간격 (0..1 비율) */
  dy?: number
  path: PathSpec
  guns: GunSpec[]
  hp?: number
  /** 편대의 마지막 한 마리가 떨군다 */
  drop?: DropKind
}

export type SkyStage = {
  id: string
  name: string
  theme: SkyTheme
  /** 마지막 편대가 끝나고 보스가 나올 때까지 */
  boss: BossSpec
  waves: WaveSpec[]
}

// ── 전체 상태 ─────────────────────────────────────────────────

export type SkyEvent =
  | 'shot' | 'hit' | 'kill' | 'bomb' | 'power' | 'coin' | 'extra'
  | 'die' | 'clear' | 'bossIn' | 'bossHit' | 'bossDown' | 'graze'

export type SkyState = {
  scene: SkyScene
  mode: SkyMode
  stage: SkyStage
  player: SkyPlayer
  shots: Shot[]
  options: Option[]
  bullets: EBullet[]
  beams: Beam[]
  enemies: SkyEnemy[]
  items: SkyItem[]
  bursts: Burst[]
  boss: SkyBoss | null
  /** 스테이지 경과(ms) */
  t: number
  /** 다음에 내보낼 편대 인덱스 */
  waveAt: number
  /** 편대 예약: [남은 시간, 스펙, 순번] */
  pending: { left: number; spec: WaveSpec; idx: number }[]
  score: number
  lives: number
  deaths: number
  /** 배경 스크롤 누적(px) */
  scroll: number
  /** 씬 연출 잔여(ms) */
  sceneMs: number
  /** 궁극기 섬광 잔여(ms) */
  flashMs: number
  /** 궁극기 지속 잔여(ms). 이 동안 들어오는 적탄도 계속 지워진다 */
  bombMs: number
  /** 다음 목숨 추가 점수 */
  nextExtra: number
  /** 화면 흔들림 잔여(ms) */
  shakeMs: number
  /** 결정적 난수 상태 */
  seed: number
  muted: boolean
  /** 보스가 나왔는가 */
  bossOut: boolean
}
