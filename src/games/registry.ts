import type { BestRecord, Mode } from '../types'

/**
 * 게임 목록.
 *
 * 첫 화면(허브)이 이 목록을 그대로 그린다. 두 번째 게임을 추가할 때는
 * 여기에 항목 하나를 넣고 main.ts 에서 그 id 를 라우팅하면 된다.
 * docs/ADD-GAME.md 에 절차를 적어 두었다.
 */
export type GameStatus = 'ready' | 'soon'

export type GameEntry = {
  id: string
  title: string
  subtitle: string
  status: GameStatus
  /** 카드 강조색 */
  accent: string
  /** 카드 썸네일에 쓸 아틀라스 프레임. 없으면 이모지를 쓴다 */
  frame?: string
  emoji?: string
  /** 썸네일 오른쪽 아래에 얹는 작은 뱃지. 같은 얼굴이라도 구분이 된다 */
  badge?: string
}

export const GAMES: readonly GameEntry[] = [
  {
    id: 'adventure',
    title: '리온의 대모험',
    subtitle: '횡스크롤 액션 · 전 20탄',
    status: 'ready',
    accent: '#4bc0ae',
    frame: 'face',
  },
  {
    id: 'sky',
    title: '리온의 하늘전투',
    subtitle: '횡스크롤 슈팅 · 전 10탄',
    status: 'ready',
    accent: '#f5a623',
    frame: 'face',
    badge: '⚡',
  },
]

export function gameById(id: string): GameEntry | undefined {
  return GAMES.find((g) => g.id === id)
}

/**
 * localStorage 키.
 *
 * 첫 게임은 예전 키를 그대로 쓴다. 키를 바꾸면 이미 깬 기록이 날아간다.
 * 두 번째 게임부터 id 로 이름공간을 나눠 서로 섞이지 않게 한다.
 */
export function progressKey(gameId: string, mode: Mode): string {
  return gameId === 'adventure'
    ? `leon_game.progress.${mode}`
    : `leon_game.${gameId}.progress.${mode}`
}

/** 허브 카드에 보여줄 진행도 한 줄 */
export function progressLabel(
  entry: GameEntry,
  records: Record<string, BestRecord>,
  total: number,
): string {
  if (entry.status === 'soon') return '곧 나옵니다'
  const cleared = Object.values(records).filter((r) => r.cleared).length
  if (cleared === 0) return `${total}탄 · 아직 시작 전`
  if (cleared >= total) return `${total}탄 전부 클리어 ★`
  return `${cleared} / ${total} 탄 클리어`
}
