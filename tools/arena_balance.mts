/**
 * 숲속대결 밸런스 측정. 리온에게 봇 두뇌를 붙여(autopilot) 판마다 여러 seed 로 돌린다.
 *   npx vite-node tools/arena_balance.mts
 */
import { ARENA_MAPS } from '../src/arena/maps'
import { newArenaState, updateArena } from '../src/arena/update'
import { advanceArenaScene, playerRank } from '../src/arena/scenes'
import { NO_INPUT } from '../src/arena/types'

const DT = 1 / 60
const SEEDS = Number(process.argv[2] ?? 30)

for (const mode of ['practice', 'challenge'] as const) {
  console.log(`== ${mode}`)
  for (const m of ARENA_MAPS) {
    let wins = 0
    let rankSum = 0
    let tSum = 0
    let maxT = 0
    let stuck = 0
    for (let seed = 1; seed <= SEEDS; seed++) {
      const s = newArenaState(m, mode, seed * 7919)
      let frames = 0
      while (s.scene !== 'clear' && s.scene !== 'gameover' && frames < 60 * 300) {
        const ev = updateArena(s, NO_INPUT, DT, { autopilot: true })
        advanceArenaScene(s, ev, DT)
        frames++
      }
      if (frames >= 60 * 300) stuck++
      if (s.scene === 'clear') wins++
      rankSum += playerRank(s)
      tSum += s.t
      maxT = Math.max(maxT, s.t)
    }
    console.log(`${m.id} ${m.name.padEnd(8)} 봇${m.bots} 승률 ${(wins / SEEDS * 100).toFixed(0).padStart(3)}% 평균순위 ${(rankSum / SEEDS).toFixed(1)} 평균 ${(tSum / SEEDS).toFixed(0)}s 최장 ${maxT.toFixed(0)}s 안끝남 ${stuck}`)
  }
}
