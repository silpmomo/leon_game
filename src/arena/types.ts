/** 숲속대결 상태 타입. 브라우저 API 를 참조하지 않는다. */

export type ArenaMode = 'practice' | 'challenge'

/**
 * 맵 타일.
 * '.' 풀 · '#' 바위(이동·탄 차단) · 'w' 물(이동만 차단) · '"' 수풀(숨기)
 * 'x' 상자(부술 수 있다, 이동·탄 차단) · 'S' 시작점(파싱 후 풀)
 */
export type ArenaTile = '.' | '#' | 'w' | '"' | 'x'

export type ArenaGrid = {
  w: number
  h: number
  cells: ArenaTile[]
  /** 상자 남은 체력. 상자가 아닌 칸은 0 */
  crateHp: Float32Array
}

export type WeaponId = 'bolt' | 'spread' | 'sniper'

export type WeaponSpec = {
  name: string
  dmg: number
  speed: number
  range: number
  pellets: number
  spread: number
  /** 탄창 한 칸 재장전 */
  reloadMs: number
  /** 연사 간격 하한 */
  cooldownMs: number
  ringCount: number
  ringDmg: number
  ringRange: number
  color: string
}

/** 봇 그림. 대모험 적 프레임 이름의 앞부분 */
export type Skin = 'leon' | 'broccoli' | 'crocodile' | 'soup' | 'spiky' | 'flyer' | 'thrower'

export type BotBrain = {
  /** 다음 판단까지 */
  thinkMs: number
  /** 이번 판단의 목적지 (월드 좌표) */
  goalX: number
  goalY: number
  /** 경로상 다음 지점 */
  wayX: number
  wayY: number
  /** 노리는 파이터 id (-1 없음) */
  target: number
  /** 옆걸음 방향 (+1/-1) */
  strafe: number
}

export type Fighter = {
  id: number
  name: string
  skin: Skin
  weapon: WeaponId
  isPlayer: boolean
  x: number
  y: number
  /** 마지막으로 바라본 방향 */
  faceX: number
  faceY: number
  hp: number
  maxHp: number
  gems: number
  /** 탄창 0..3 (소수 = 재장전 중) */
  ammo: number
  cooldownMs: number
  /** 0..1 */
  superCharge: number
  /** 마지막 공격·피격 이후 */
  calmMs: number
  revealMs: number
  hurtMs: number
  alive: boolean
  kills: number
  /** 쓰러진 순서로 매긴 순위 (살아 있으면 0) */
  rank: number
  brain: BotBrain | null
}

export type Bullet = {
  owner: number
  x: number
  y: number
  vx: number
  vy: number
  /** 남은 비행 거리 */
  left: number
  dmg: number
  color: string
  /** 필살기 탄은 상자를 한 방에 부수고 굵게 그린다 */
  big: boolean
}

export type Gem = { x: number; y: number; bobMs: number }

export type Burst = { x: number; y: number; ms: number; color: string }

export type BotDifficulty = {
  /** 조준 오차 (라디안) */
  aimError: number
  /** 판단 간격 */
  thinkMs: number
  /** 이 거리 안의 보이는 상대를 노린다 */
  aggro: number
  /** 체력이 이 비율 아래면 물러난다 */
  fleeAt: number
}

export type ArenaMap = {
  id: string
  name: string
  /** 4분면(왼쪽 위) 아스키. 오른쪽·아래로 거울 복사된다 */
  quadrant: readonly string[]
  bots: number
  difficulty: BotDifficulty
  /** 봇이 들 무기 순서 (돌려 쓴다) */
  weapons: readonly WeaponId[]
  theme: 'meadow' | 'lake' | 'rock' | 'mushroom' | 'river' | 'royal'
}

export type ArenaScene = 'countdown' | 'playing' | 'dead' | 'clear' | 'gameover'

export type ArenaEvent =
  | 'shot' | 'hit' | 'crate' | 'gem' | 'kill' | 'super'
  | 'playerHurt' | 'die' | 'win' | 'gasStart'

export type ArenaInput = {
  /** 이동 벡터 (길이 ≤ 1) */
  mx: number
  my: number
  /** 공격 버튼을 누르고 있는가 */
  fire: boolean
  /** 이번 프레임에 필살기를 눌렀는가 */
  superPressed: boolean
}

export const NO_INPUT: ArenaInput = { mx: 0, my: 0, fire: false, superPressed: false }

export type ArenaState = {
  map: ArenaMap
  grid: ArenaGrid
  spawns: readonly [number, number][]
  mode: ArenaMode
  scene: ArenaScene
  sceneMs: number
  /** 경기 시간 (초). 카운트다운 동안은 흐르지 않는다 */
  t: number
  seed: number
  fighters: Fighter[]
  bullets: Bullet[]
  gems: Gem[]
  bursts: Burst[]
  score: number
  /** 마지막으로 매긴 순위 — 다음에 쓰러지는 파이터가 받는다 */
  nextRank: number
  muted: boolean
  gasAnnounced: boolean
}
