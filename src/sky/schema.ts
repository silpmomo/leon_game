import type { GunSpec, SkyStage, WaveSpec } from './types'
import { SKY_H, SKY_W } from './tuning'

/**
 * 스테이지 데이터 검증.
 *
 * 기존 게임의 levels/schema.ts 와 같은 자리다. 잘못된 스테이지로는 부팅하지
 * 않고 원인을 보여준다 — 검은 화면을 보는 것보다 낫다.
 */

const THEMES = new Set([
  'dawn', 'cloud', 'forest', 'storm', 'volcano',
  'night', 'ice', 'desert', 'steam', 'castle',
])

const PATTERNS = new Set([
  'aimed', 'spread', 'ring', 'spiral', 'homing',
  'wave', 'burst', 'rain', 'arc', 'laser',
])

function checkGun(where: string, g: GunSpec): void {
  if (!PATTERNS.has(g.pattern)) throw new Error(`${where}: 모르는 패턴 ${g.pattern}`)
  if (!(g.everyMs > 0)) throw new Error(`${where}: everyMs 는 양수여야 한다 (${g.everyMs})`)
  if (g.count !== undefined && g.count < 1) throw new Error(`${where}: count 가 ${g.count}`)
  if (g.speed !== undefined && !(g.speed > 0)) throw new Error(`${where}: speed 가 ${g.speed}`)
  if (g.arc !== undefined && g.arc < 0) throw new Error(`${where}: arc 가 음수`)
  if (g.burstShots !== undefined && g.burstShots < 1) {
    throw new Error(`${where}: burstShots 가 ${g.burstShots}`)
  }
  // 연사를 걸었으면 쉬는 시간이 있어야 한다. 없으면 그냥 빠른 연사와 같다
  if (g.burstShots !== undefined && g.restMs === undefined) {
    throw new Error(`${where}: burstShots 를 쓰면 restMs 도 있어야 한다`)
  }
}

function checkWave(where: string, w: WaveSpec): void {
  if (w.atMs < 0) throw new Error(`${where}: atMs 가 음수`)
  if (w.count < 1) throw new Error(`${where}: count 가 ${w.count}`)
  if (w.gapMs < 0) throw new Error(`${where}: gapMs 가 음수`)
  if (w.hp !== undefined && !(w.hp > 0)) throw new Error(`${where}: hp 가 ${w.hp}`)
  if (w.path.kind !== 'anchor' && !(w.path.speed > 0)) {
    throw new Error(`${where}: 이동 속도가 ${w.path.speed} — 화면에 멈춰 붙는다`)
  }
  if (w.path.kind === 'hover') {
    const hx = w.path.holdX ?? SKY_W * 0.7
    if (hx <= 0 || hx >= SKY_W) throw new Error(`${where}: holdX ${hx} 가 화면 밖`)
  }
  if (w.guns.length === 0 && w.drop === null && w.atMs > 8000) {
    // 총도 없고 아이템도 안 주는 편대는 8초 뒤에는 있을 이유가 없다
    throw new Error(`${where}: 총도 아이템도 없는 편대`)
  }
  w.guns.forEach((g, i) => checkGun(`${where} 총${i}`, g))
}

export function assertValidSkyStage(s: SkyStage): void {
  const at = `스테이지 ${s.id}`
  if (!/^sky-\d\d$/.test(s.id)) throw new Error(`${at}: id 형식이 다르다`)
  if (s.name.length === 0) throw new Error(`${at}: 이름이 비었다`)
  if (!THEMES.has(s.theme)) throw new Error(`${at}: 모르는 테마 ${s.theme}`)
  if (s.waves.length === 0) throw new Error(`${at}: 편대가 없다`)

  let prev = -1
  s.waves.forEach((w, i) => {
    if (w.atMs < prev) throw new Error(`${at} 편대${i}: 등장 시각이 앞 편대보다 이르다`)
    prev = w.atMs
    checkWave(`${at} 편대${i}`, w)
  })

  // 파워업을 한 번도 안 주면 계속 1단계로 싸워야 한다
  if (!s.waves.some((w) => w.drop === 'power')) {
    throw new Error(`${at}: 파워업을 주는 편대가 없다`)
  }

  const b = s.boss
  if (b.name.length === 0) throw new Error(`${at}: 보스 이름이 비었다`)
  if (b.w <= 0 || b.h <= 0) throw new Error(`${at}: 보스 크기가 0 이하`)
  if (b.w > SKY_W * 0.4) throw new Error(`${at}: 보스가 화면 폭의 40% 를 넘는다`)
  if (b.h > SKY_H * 0.75) throw new Error(`${at}: 보스가 너무 커서 피할 자리가 없다`)
  if (b.phases.length === 0) throw new Error(`${at}: 보스 페이즈가 없다`)
  b.phases.forEach((p, i) => {
    if (!(p.hp > 0)) throw new Error(`${at} 보스 페이즈${i}: 체력이 ${p.hp}`)
    if (p.guns.length === 0) throw new Error(`${at} 보스 페이즈${i}: 총이 없다`)
    p.guns.forEach((g, j) => checkGun(`${at} 보스 페이즈${i} 총${j}`, g))
  })
}

export function bossTotalHp(s: SkyStage): number {
  return s.boss.phases.reduce((a, p) => a + p.hp, 0)
}

/** 스테이지 전체를 한꺼번에 검증한다 */
export function assertValidSkyStages(stages: readonly SkyStage[]): void {
  const ids = new Set<string>()
  for (const s of stages) {
    if (ids.has(s.id)) throw new Error(`스테이지 id 중복: ${s.id}`)
    ids.add(s.id)
    assertValidSkyStage(s)
  }
  /*
   * 뒤로 갈수록 보스가 세져야 한다.
   *
   * 단, 체력의 단조 증가를 요구하면 안 된다. 보스마다 이동이 달라 같은 시간을
   * 싸워도 맞는 양이 다르다 — 제자리에서 도는 보스는 잘 맞아서 체력이 더
   * 필요하고, 화면을 쓸고 다니는 보스는 덜 맞아 적은 체력으로도 오래 간다.
   * (실제 격파 시간은 tools/sky_balance.mts 가 재서 맞춘다.)
   * 여기서는 오타로 자릿수가 틀리는 것만 잡는다.
   */
  for (let i = 1; i < stages.length; i++) {
    const a = bossTotalHp(stages[i - 1]!)
    const b = bossTotalHp(stages[i]!)
    if (b < a * 0.85) {
      throw new Error(`${stages[i]!.id} 보스가 앞 탄보다 눈에 띄게 약하다 (${a} → ${b})`)
    }
    if (stages[i]!.boss.phases.length < stages[i - 1]!.boss.phases.length) {
      throw new Error(`${stages[i]!.id} 보스 페이즈가 앞 탄보다 적다`)
    }
  }

  const first = bossTotalHp(stages[0]!)
  const last = bossTotalHp(stages[stages.length - 1]!)
  if (last < first * 3) {
    throw new Error(`마지막 보스가 첫 보스의 3배도 안 된다 (${first} → ${last})`)
  }
}
