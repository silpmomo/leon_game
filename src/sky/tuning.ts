import { VIEW_H, VIEW_W } from '../engine/tuning'

/** 리온의 하늘전투 상수. 화면은 기존 게임과 같은 416×192 를 쓴다. */

export const SKY_W = VIEW_W
export const SKY_H = VIEW_H

/** 플레이어가 나갈 수 있는 범위 */
export const BOUND = { x0: 6, x1: SKY_W - 10, y0: 8, y1: SKY_H - 12 }

/**
 * 피탄 판정 반지름. 그림(14×22)보다 훨씬 작다.
 * 슈팅의 관례이고, 이게 없으면 탄막을 피할 수가 없다.
 */
export const PLAYER_R = 2

export const PLAYER = {
  /** 키보드 이동 속도(px/s) */
  keySpeed: 132,
  /** 경직 중 이동 배수 */
  stunSlow: 0.45,
  /** 접촉 경직(ms) */
  stunMs: 420,
  /** 부활 무적(ms) */
  respawnInvMs: 1800,
  /** 궁극기 무적(ms) */
  bombInvMs: 1400,
  /** 최대 파워 단계 (0..3) */
  maxPower: 3,
  maxBombs: 6,
  startBombs: 3,
} as const

/**
 * 파워 단계별 샷. cool 은 발사 간격(ms).
 *
 * 갈래가 늘 때 발당 피해까지 같이 두면 1단계와 4단계의 화력 차가 7배가 되어
 * 보스가 1초에 녹았다. 갈래가 늘면 발당 피해를 줄여 3.6배쯤으로 눌렀다.
 * 확산각도 좁혔다. 0.22rad 로 벌리면 280px 떨어진 보스에서는 바깥 두 갈래가
 * ±60px 빗나가 가운데 한 발만 맞는다 — 실측 초당 피해가 43까지 떨어졌다.
 */
export const SHOT_LEVELS = [
  { cool: 110, ways: 1, spread: 0, dmg: 7, options: 0, missiles: 0 },
  { cool: 110, ways: 2, spread: 0, dmg: 5, options: 1, missiles: 0 },
  { cool: 110, ways: 3, spread: 0.10, dmg: 5, options: 2, missiles: 0 },
  { cool: 100, ways: 3, spread: 0.12, dmg: 5, options: 2, missiles: 1 },
] as const

export const SHOT_SPEED = 400
/** 미사일은 몇 발에 한 번 나가는가 */
export const MISSILE_EVERY = 4
export const MISSILE_SPEED = 250
export const MISSILE_TURN = 4.2
export const MISSILE_DMG = 6

/** 옵션(사역마)이 본체를 따라오는 비율. 1프레임당 */
export const OPTION_FOLLOW = 0.16
export const OPTION_COOL = 150
export const OPTION_DMG = 2

export const BOMB = {
  /** 화면 전체 피해 */
  dmg: 90,
  /** 지속(ms) — 이 동안 탄이 계속 지워진다 */
  ms: 900,
  flashMs: 260,
  shakeMs: 420,
} as const

/** 코인 값: 먹을 때까지 걸린 시간에 따라 떨어진다 (텐가이와 같은 규칙) */
export const COIN = { max: 2000, min: 200, decayMs: 4000 } as const

export const SCORE = {
  bombFull: 10_000,
  /** 남은 궁극기 하나당 클리어 보너스 */
  bombLeft: 3000,
  /** 노 미스 클리어 */
  noMiss: 20_000,
  stageClear: 5000,
} as const

export const LIVES_CHALLENGE = 3

/** 배경이 흐르는 속도(px/s) */
export const SCROLL_SPEED = 46

/** 씬 연출 길이 */
export const DEAD_MS = 1300
export const CLEAR_MS = 2200
export const BOSS_ENTER_MS = 1600
export const BOSS_MORPH_MS = 900
export const BOSS_DIE_MS = 1800

/** 보스가 나온 뒤 이 시간이 지나도 안 죽으면 탄이 조금 빨라진다 */
export const BOSS_RUSH_MS = 45_000

/** 화면 밖 이 거리까지는 탄·적을 살려둔다 */
export const CULL = 40
