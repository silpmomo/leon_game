import type { WeaponId, WeaponSpec } from './types'

/** 숲속대결 상수. 밸런스는 여기서만 만진다. */

export const TILE = 12
export const MAP_W = 48
export const MAP_H = 32
export const WORLD_W = MAP_W * TILE
export const WORLD_H = MAP_H * TILE

/** 파이터 몸 반지름 (충돌은 한 변 2R 의 사각형) */
export const FIGHTER_R = 5
export const BASE_HP = 100
export const SPEED = 62
/** 별 하나당 최대 체력·공격력 증가 */
export const GEM_HP = 10
export const GEM_DMG = 0.1

/** 공격·피격 없이 이 시간이 지나면 회복이 시작된다 */
export const HEAL_DELAY_MS = 3000
/** 초당 최대 체력의 비율 */
export const HEAL_RATE = 0.13

/** 수풀 속 상대가 보이는 거리 */
export const BUSH_SEE_PX = TILE * 2.5
/** 쏘면 이만큼 드러난다 */
export const REVEAL_MS = 1000

export const CRATE_HP = 70
export const GEM_PICK_R = 9

/** 독안개 */
export const GAS_DELAY_S = 20
export const GAS_SHRINK_S = 70
/** 마지막에 남는 안전지대 비율 (가로·세로 각각) */
export const GAS_MIN_FRAC = 0.15
export const GAS_DPS = 20

/** 필살기 게이지를 다 채우는 데 필요한 누적 피해 */
export const SUPER_COST = 90

export const COUNTDOWN_MS = 2000
export const DEAD_MS = 1600
export const CLEAR_MS = 600

/**
 * 봇이 리온에게 주는 피해 배율. 봇끼리는 원래대로 때린다.
 * tools/arena_balance.mts 로 잰 승률을 보고 정했다 (docs/ARENA.md).
 */
export const BOT_DMG_TO_PLAYER = { practice: 0.45, challenge: 0.8 } as const

export const SCORE = {
  kill: 100,
  gem: 20,
  rank: [0, 1000, 600, 300] as readonly number[],
} as const

/**
 * 무기표.
 *
 * range 는 탄이 날아가는 거리(px). pellets 가 1보다 크면 spread 라디안
 * 안에 고르게 벌린다. 필살기는 사방 링이고 ring* 로 정한다.
 */
export const WEAPONS: Record<WeaponId, WeaponSpec> = {
  bolt: {
    name: '번개',
    dmg: 22, speed: 230, range: 112, pellets: 1, spread: 0,
    reloadMs: 1100, cooldownMs: 320,
    ringCount: 12, ringDmg: 26, ringRange: 96,
    color: '#7fd8ff',
  },
  spread: {
    name: '산탄',
    dmg: 9, speed: 210, range: 72, pellets: 5, spread: 0.55,
    reloadMs: 1250, cooldownMs: 420,
    ringCount: 16, ringDmg: 20, ringRange: 70,
    color: '#ffb04a',
  },
  sniper: {
    name: '저격',
    dmg: 32, speed: 280, range: 156, pellets: 1, spread: 0,
    reloadMs: 1700, cooldownMs: 520,
    ringCount: 10, ringDmg: 30, ringRange: 120,
    color: '#ff6a8a',
  },
}
