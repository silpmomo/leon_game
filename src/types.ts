// 공유 순수 타입. 브라우저 API를 참조하지 않는다.
//
// 스펙 §3.2는 InputState를 core/input.ts에 두었지만, 그러면 순수 모듈
// world/player.ts가 껍질 계층을 import하게 되어 §3.1 경계 규칙을 스스로
// 위반한다. 그래서 공유 타입을 전부 이 파일에 모은다 (계획 정정 1).

export type Rect = { x: number; y: number; w: number; h: number }

/** 물리 몸체. 좌표는 논리 픽셀, 속도는 px/s. */
export type Body = {
  x: number
  y: number
  vx: number
  vy: number
  w: number
  h: number
  onGround: boolean
}

export type InputState = {
  left: boolean
  right: boolean
  /** 점프 버튼을 누르고 있는가 (가변 점프용) */
  jump: boolean
  /** 이 프레임에 새로 눌렸는가 (점프 버퍼용) */
  jumpPressed: boolean
  /** 발사 버튼이 이 프레임에 새로 눌렸는가 */
  firePressed: boolean
}

export const EMPTY_INPUT: InputState = {
  left: false,
  right: false,
  jump: false,
  jumpPressed: false,
  firePressed: false,
}

/** 레벨 아스키 격자에 쓰이는 문자 */
export type Tile =
  | '.' // 빈칸
  | '#' // 땅 (파괴 불가)
  | 'B' // 벽돌
  | 'b' // 벽돌 + 코인 숨김
  | '?' // ? 블록 → 코인
  | '@' // ? 블록 → 복숭아
  | '*' // ? 블록 → 축구공
  | 'H' // 단단블록 (튕김만)
  | 'p' // 파이프 상단
  | '|' // 파이프 몸통
  | 'o' // 코인 (파싱 시 Coin으로 변환되고 타일은 '.'가 된다)

export type TileGrid = {
  w: number
  h: number
  /** 길이 w*h, 행 우선 */
  cells: Tile[]
  /** 1 = 벽돌이 부서져 빈칸 */
  broken: Uint8Array
  /** 1 = ? 블록이 사용됨 (여전히 solid) */
  used: Uint8Array
}

/** small → big → ball. 'ball'은 "큰 상태 + 축구공 보유"를 뜻한다. */
export type PowerState = 'small' | 'big' | 'ball'
export type Mode = 'practice' | 'challenge'
export type Scene = 'title' | 'playing' | 'dead' | 'clear' | 'gameover'

export type Player = Body & {
  power: PowerState
  facing: 1 | -1
  /** 피격 후 무적 남은 시간(ms) */
  invulnMs: number
  /** 발판을 떠난 뒤 점프가 아직 허용되는 남은 시간(ms) */
  coyoteMs: number
  /** 착지 시 발동시킬 점프 입력의 남은 유효시간(ms) */
  jumpBufferMs: number
  /** 상승 중이고 버튼을 계속 누르고 있는가 (가변 점프) */
  rising: boolean
  /** 방향 버튼을 유지한 누적 시간(ms) → 자동 가속 */
  runMs: number
  skidding: boolean
  /** 깃대를 잡고 미끄러지는 중 */
  sliding: boolean
}

export type EnemyKind = 'broccoli' | 'soup' | 'crocodile'

export type Enemy = Body & {
  kind: EnemyKind
  dir: 1 | -1
  /** 스폰 원점 (카메라 진입 판정용) */
  homeX: number
  active: boolean
  alive: boolean
  /** 미역국 점프 주기, 악어 돌진 플래그 등 범용 타이머(ms) */
  timerMs: number
  /** 남은 피격 횟수 */
  hp: number
  /** 밟혀서 납작해진 뒤 사라지기까지의 잔여 시간(ms). 0이면 미해당 */
  squashMs: number
}

export type Coin = Rect & { taken: boolean }

/** ? 블록에서 나와 굴러가는 아이템 */
export type Item = Body & { kind: 'peach' | 'ball'; taken: boolean }

/** 발사된 축구공 */
export type Ball = Body & { bounces: number; alive: boolean }

export type Platform = Body & {
  axis: 'x' | 'y'
  /** 원점에서 왕복하는 타일 수 */
  range: number
  speed: number
  originX: number
  originY: number
  dir: 1 | -1
}

/** 블록을 아래에서 쳤을 때의 튕김 애니메이션 */
export type Bump = { tx: number; ty: number; ms: number }

export type LevelEntity =
  | { type: 'broccoli' | 'soup' | 'crocodile'; x: number; y: number; dir?: 1 | -1 }
  | { type: 'platform'; x: number; y: number; axis: 'x' | 'y'; range: number; speed: number }

export type LevelData = {
  name: string
  width: number
  height: number
  spawn: { x: number; y: number }
  goal: { x: number; flagTop: number }
  tiles: string[]
  entities: LevelEntity[]
  checkpoints: number[]
}

/** 모드별 최고기록. 이름이 전역 Record와 겹치지 않게 BestRecord로 쓴다. */
export type BestRecord = {
  cleared: boolean
  bestScore: number
  bestTimeMs: number
  fewestDeaths: number
}

export type GameState = {
  scene: Scene
  mode: Mode
  level: LevelData
  grid: TileGrid
  player: Player
  enemies: Enemy[]
  coins: Coin[]
  items: Item[]
  balls: Ball[]
  platforms: Platform[]
  bumps: Bump[]
  camera: { x: number; y: number }
  coinCount: number
  score: number
  lives: number
  /** 도전 모드는 남은 시간, 연습 모드는 경과 시간 (ms) */
  timeMs: number
  deaths: number
  /** 연속 밟기 콤보 단계 (0부터) */
  combo: number
  /** 마지막으로 통과한 체크포인트의 타일 X. 없으면 spawn.x */
  checkpointX: number
  /** 씬 전환 연출용 잔여 시간(ms) */
  sceneMs: number
  muted: boolean
}
