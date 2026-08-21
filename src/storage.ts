import type { BestRecord, Mode } from './types'

export const EMPTY_RECORD: BestRecord = {
  cleared: false,
  bestScore: 0,
  bestTimeMs: 0,
  fewestDeaths: 0,
}

const KEY = (mode: Mode) => `leon_game.record.${mode}`
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

export function loadRecord(mode: Mode): BestRecord {
  const raw = read(KEY(mode))
  if (!raw) return { ...EMPTY_RECORD }
  try {
    const parsed = JSON.parse(raw) as Partial<BestRecord>
    return {
      cleared: parsed.cleared === true,
      bestScore: Number(parsed.bestScore) || 0,
      bestTimeMs: Number(parsed.bestTimeMs) || 0,
      fewestDeaths: Number(parsed.fewestDeaths) || 0,
    }
  } catch {
    return { ...EMPTY_RECORD }
  }
}

export function saveRecord(mode: Mode, r: BestRecord): void {
  write(KEY(mode), JSON.stringify(r))
}

export function loadMuted(): boolean {
  return read(MUTE_KEY) === '1'
}

export function saveMuted(v: boolean): void {
  write(MUTE_KEY, v ? '1' : '0')
}
