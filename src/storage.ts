import type { BestRecord, Mode, Progress } from './types'

export const EMPTY_RECORD: BestRecord = {
  cleared: false,
  bestScore: 0,
  bestTimeMs: 0,
  fewestDeaths: 0,
}

const KEY = (mode: Mode) => `leon_game.progress.${mode}`
const MUTE_KEY = 'leon_game.muted'

/** 시크릿 모드·차단 설정에서는 접근 자체가 throw한다. 저장 실패는 무시한다. */
function read(key: string): string | null {
  try {
    return window.localStorage.getItem(key)
  } catch {
    return null
  }
}

function write(key: string, value: string): void {
  try {
    window.localStorage.setItem(key, value)
  } catch {
    // 기록 저장만 포기하고 플레이는 계속한다
  }
}

function sanitize(v: unknown): BestRecord {
  const o = (v ?? {}) as Partial<BestRecord>
  return {
    cleared: o.cleared === true,
    bestScore: Number(o.bestScore) || 0,
    bestTimeMs: Number(o.bestTimeMs) || 0,
    fewestDeaths: Number(o.fewestDeaths) || 0,
  }
}

/** 모드별 진행도 전체. 스테이지 id → 기록 */
export function loadProgress(mode: Mode): Progress {
  const raw = read(KEY(mode))
  if (!raw) return {}
  try {
    const parsed = JSON.parse(raw) as Record<string, unknown>
    const out: Progress = {}
    for (const [id, v] of Object.entries(parsed)) out[id] = sanitize(v)
    return out
  } catch {
    return {}
  }
}

export function saveProgress(mode: Mode, p: Progress): void {
  write(KEY(mode), JSON.stringify(p))
}

export function recordFor(p: Progress, stageId: string): BestRecord {
  return p[stageId] ?? { ...EMPTY_RECORD }
}

export function loadMuted(): boolean {
  return read(MUTE_KEY) === '1'
}

export function saveMuted(v: boolean): void {
  write(MUTE_KEY, v ? '1' : '0')
}
