import { describe, expect, it } from 'vitest'
import {
  GAMES,
  gameById,
  progressKey,
  progressLabel,
  type GameEntry,
} from '../src/games/registry'
import { cardRect, firstReadyGame, gameHitTest } from '../src/ui/gameSelect'
import { hubHitTest } from '../src/ui/titleScreen'
import { VIEW_H, VIEW_W } from '../src/engine/tuning'
import type { BestRecord } from '../src/types'

const done: BestRecord = { cleared: true, bestScore: 1, bestTimeMs: 1, fewestDeaths: 0 }
const tried: BestRecord = { cleared: false, bestScore: 0, bestTimeMs: 0, fewestDeaths: 0 }

const center = (i: number) => {
  const r = cardRect(i, GAMES.length)
  return [r.x + r.w / 2, r.y + r.h / 2] as const
}

describe('게임 레지스트리', () => {
  it('첫 게임은 리온의 대모험이고 바로 할 수 있다', () => {
    expect(GAMES[0]!.id).toBe('adventure')
    expect(GAMES[0]!.title).toBe('리온의 대모험')
    expect(GAMES[0]!.status).toBe('ready')
  })

  it('두 번째 게임은 하늘전투다', () => {
    expect(GAMES.length).toBeGreaterThanOrEqual(2)
    expect(GAMES[1]!.id).toBe('sky')
    expect(GAMES[1]!.title).toBe('리온의 하늘전투')
    expect(GAMES[1]!.status).toBe('ready')
  })

  it('같은 얼굴을 쓰는 카드끼리는 뱃지로 구분된다', () => {
    // 두 게임 다 리온이라 썸네일이 같다. 뱃지가 없으면 한눈에 구분이 안 된다
    const sameFrame = GAMES.filter((g) => g.frame === 'face')
    if (sameFrame.length > 1) {
      const marks = sameFrame.map((g) => g.badge ?? '')
      expect(marks.filter(Boolean).length, '뱃지 없는 카드가 겹친다')
        .toBeGreaterThanOrEqual(sameFrame.length - 1)
    }
  })

  it('id 가 중복되지 않는다', () => {
    const ids = GAMES.map((g) => g.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('gameById 로 찾을 수 있고 없는 id 는 undefined', () => {
    expect(gameById('adventure')?.title).toBe('리온의 대모험')
    expect(gameById('없음')).toBeUndefined()
  })

  it('모든 항목에 제목·설명·강조색이 있다', () => {
    for (const g of GAMES) {
      expect(g.title.length, g.id).toBeGreaterThan(0)
      expect(g.subtitle.length, g.id).toBeGreaterThan(0)
      expect(g.accent, g.id).toMatch(/^#[0-9a-f]{6}$/i)
    }
  })

  it('썸네일이 프레임이나 이모지 둘 중 하나는 있다', () => {
    for (const g of GAMES) {
      expect(Boolean(g.frame || g.emoji), `${g.id} 에 썸네일이 없다`).toBe(true)
    }
  })
})

describe('진행도 저장 키', () => {
  it('첫 게임은 예전 키를 그대로 쓴다 (기존 기록 보존)', () => {
    // 키를 바꾸면 이미 깬 20탄 기록이 날아간다
    expect(progressKey('adventure', 'practice')).toBe('leon_game.progress.practice')
    expect(progressKey('adventure', 'challenge')).toBe('leon_game.progress.challenge')
  })

  it('두 번째 게임부터는 id 로 이름공간을 나눈다', () => {
    expect(progressKey('game2', 'practice')).toBe('leon_game.game2.progress.practice')
  })

  it('게임끼리 키가 겹치지 않는다', () => {
    const keys = GAMES.flatMap((g) => [
      progressKey(g.id, 'practice'),
      progressKey(g.id, 'challenge'),
    ])
    expect(new Set(keys).size).toBe(keys.length)
  })
})

describe('진행도 표시', () => {
  const adv = GAMES[0]!

  it('시작 전이면 탄 수를 알려준다', () => {
    expect(progressLabel(adv, {}, 20)).toContain('20탄')
  })

  it('진행 중이면 클리어 수를 보여준다', () => {
    expect(progressLabel(adv, { a: done, b: done, c: tried }, 20)).toBe('2 / 20 탄 클리어')
  })

  it('전부 깨면 별을 붙인다', () => {
    const all = Object.fromEntries(
      Array.from({ length: 20 }, (_, i) => [`s${i}`, done]),
    )
    expect(progressLabel(adv, all, 20)).toContain('★')
  })

  it('준비 중인 게임은 진행도 대신 안내를 보여준다', () => {
    // GAMES 안에 'soon' 이 없을 수도 있으므로 규칙 자체를 검사한다
    const soon: GameEntry = {
      id: 'later', title: '나중 게임', subtitle: '준비 중',
      status: 'soon', accent: '#5a6472', emoji: '🚧',
    }
    expect(progressLabel(soon, {}, 0)).toBe('곧 나옵니다')
  })
})

describe('허브 카드 배치', () => {
  it('카드가 서로 겹치지 않는다', () => {
    for (let i = 0; i < GAMES.length; i++) {
      for (let j = i + 1; j < GAMES.length; j++) {
        const a = cardRect(i, GAMES.length)
        const b = cardRect(j, GAMES.length)
        const overlap = a.x < b.x + b.w && b.x < a.x + a.w
        expect(overlap, `${i}번과 ${j}번 카드가 겹친다`).toBe(false)
      }
    }
  })

  it('모든 카드가 화면 안에 있다', () => {
    for (let i = 0; i < GAMES.length; i++) {
      const r = cardRect(i, GAMES.length)
      expect(r.x).toBeGreaterThanOrEqual(0)
      expect(r.y).toBeGreaterThanOrEqual(0)
      expect(r.x + r.w).toBeLessThanOrEqual(VIEW_W)
      expect(r.y + r.h).toBeLessThanOrEqual(VIEW_H)
    }
  })

  it('게임이 늘어나도 화면 안에 들어간다', () => {
    for (const count of [1, 2, 3, 4]) {
      for (let i = 0; i < count; i++) {
        const r = cardRect(i, count)
        expect(r.x + r.w, `${count}개 중 ${i}번`).toBeLessThanOrEqual(VIEW_W)
        expect(r.w, `${count}개일 때 카드 폭`).toBeGreaterThan(40)
      }
    }
  })
})

describe('허브 클릭 판정', () => {
  it('할 수 있는 게임을 누르면 id 를 준다', () => {
    expect(gameHitTest(...center(0))).toBe('adventure')
  })

  it('할 수 있는 카드만 열리고 준비 중인 카드는 안 열린다', () => {
    // 목록이 바뀌어도 성립하는 규칙으로 검사한다
    for (let i = 0; i < GAMES.length; i++) {
      const g = GAMES[i]!
      expect(gameHitTest(...center(i)), g.id)
        .toBe(g.status === 'ready' ? g.id : null)
    }
  })

  it('카드 밖을 누르면 null 이다', () => {
    expect(gameHitTest(2, 2)).toBeNull()
    expect(gameHitTest(VIEW_W / 2, VIEW_H - 3)).toBeNull()
  })

  it('키보드로 시작하면 첫 번째 가능한 게임이 잡힌다', () => {
    expect(firstReadyGame()).toBe('adventure')
  })
})

describe('타이틀에서 허브로', () => {
  it('좌상단 버튼이 눌린다', () => {
    expect(hubHitTest(20, 12)).toBe(true)
  })

  it('다른 곳은 안 눌린다', () => {
    expect(hubHitTest(VIEW_W / 2, VIEW_H / 2)).toBe(false)
  })

  it('탄 고르기의 뒤로 버튼과 자리가 같다 (일관된 위치)', () => {
    // 두 화면 모두 좌상단 같은 자리에서 한 단계 위로 간다
    expect(hubHitTest(28, 13)).toBe(true)
  })
})

describe('게임 추가 가능성', () => {
  it('새 항목을 넣어도 배치·판정이 깨지지 않는다', () => {
    const extra: GameEntry = {
      id: 'game3',
      title: '세 번째',
      subtitle: '테스트',
      status: 'soon',
      accent: '#ffffff',
      emoji: '🎲',
    }
    const count = GAMES.length + 1
    const r = cardRect(count - 1, count)
    expect(r.x + r.w).toBeLessThanOrEqual(VIEW_W)
    expect(progressKey(extra.id, 'practice')).toBe('leon_game.game3.progress.practice')
  })
})
