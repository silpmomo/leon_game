/**
 * 보스 체력을 측정해서 되맞춘다.
 *
 * 손으로 숫자를 찍으면 반드시 틀린다 — 실제 초당 피해는 확산각·보스 이동·
 * 히트박스에 달려 있어서 계산으로 안 나온다. 완벽 조준으로 한 번 돌려
 * 실측 dps 를 구하고, 원하는 초에 맞춰 체력을 다시 쓴다.
 *
 * 실행: npx vite-node tools/sky_balance.mts [--write]
 */
import { readFileSync, writeFileSync } from 'node:fs'
import { SKY_STAGES, wavesEndMs } from '../src/sky/stages'
import { newSkyState, updateSky } from '../src/sky/update'
import { advanceSkyScene } from '../src/sky/scenes'
import { SKY_H } from '../src/sky/tuning'

const DT = 1 / 60
/** 보스와의 거리. 너무 붙으면 과대평가, 끝에 붙으면 과소평가된다 */
const HOLD_X = 150

/** 1탄 14초 → 10탄 30초 */
function targetSecs(i: number): number {
  return 14 + (i / 9) * 16
}

function ttk(i: number): number {
  const s = newSkyState(SKY_STAGES[i]!, 'practice')
  s.player.power = 3
  s.t = wavesEndMs(s.stage)
  s.waveAt = s.stage.waves.length
  for (let f = 0; f < 60 * 240; f++) {
    s.player.invMs = 999
    const b = s.boss
    const ev = updateSky(s, { tx: HOLD_X, ty: b ? b.y : SKY_H / 2, ax: 0, ay: 0, bomb: false }, DT)
    advanceSkyScene(s, ev, DT)
    if (s.scene === 'clear') return f / 60
  }
  return 240
}

const rows: { i: number; secs: number; hp: number; scale: number }[] = []
for (let i = 0; i < SKY_STAGES.length; i++) {
  const hp = SKY_STAGES[i]!.boss.phases.reduce((a, p) => a + p.hp, 0)
  const secs = ttk(i)
  // 등장·변신 연출 시간은 피해를 못 주는 구간이라 빼고 dps 를 잰다
  const dead = 1.6 + 0.9 * (SKY_STAGES[i]!.boss.phases.length - 1) + 1.8
  const dps = hp / Math.max(0.1, secs - dead)
  const want = Math.round(dps * (targetSecs(i) - dead))
  rows.push({ i, secs, hp, scale: want / hp })
  console.log(
    `${SKY_STAGES[i]!.boss.name.padEnd(7)} 체력 ${String(hp).padStart(5)}`
    + ` 실측 ${secs.toFixed(1).padStart(5)}초 (dps ${dps.toFixed(0).padStart(3)})`
    + ` 목표 ${targetSecs(i).toFixed(0)}초 → ×${(want / hp).toFixed(2)}`,
  )
}

if (process.argv.includes('--write')) {
  // stages.ts 의 phase(<hp>, 를 스테이지 순서대로 다시 쓴다
  const path = 'src/sky/stages.ts'
  let src = readFileSync(path, 'utf8')
  let n = 0
  let stage = -1
  let seen = 0
  const counts = SKY_STAGES.map((s) => s.boss.phases.length)
  src = src.replace(/phase\((\d+), /g, (_m, hpStr: string) => {
    if (seen === 0) {
      stage += 1
      seen = counts[stage]!
    }
    seen -= 1
    n += 1
    const scaled = Math.round(Number(hpStr) * rows[stage]!.scale / 10) * 10
    return `phase(${scaled}, `
  })
  writeFileSync(path, src)
  console.log(`\n${path} 의 페이즈 ${n}개를 다시 썼다`)
}
