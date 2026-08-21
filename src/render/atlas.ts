export type FrameRect = { x: number; y: number; w: number; h: number }
export type AtlasData = { sheet: string; frames: Record<string, FrameRect> }

export type LoadedAtlas = {
  data: AtlasData
  /** null이면 스프라이트를 못 읽은 것 — 렌더러가 폴백 사각형을 그린다 */
  image: HTMLImageElement | null
}

/** 이 프레임들이 없으면 렌더러가 폴백 사각형을 그린다 */
export const REQUIRED_FRAMES = [
  'face',
  'heroSmallIdle',
  'heroSmallWalk1',
  'heroSmallWalk2',
  'heroSmallWalk3',
  'heroSmallWalk4',
  'heroSmallJump',
  'heroSmallSkid',
  'heroBigIdle',
  'heroBigWalk1',
  'heroBigJump',
  'broccoli0',
  'broccoli1',
  'broccoliSquash',
  'soupCrouch',
  'soupJump',
  'crocodile0',
  'crocodile1',
  'peach',
  'ball0',
  'ball1',
  'ball2',
  'ball3',
  'coin0',
  'coin1',
  'coin2',
  'coin3',
  'ground',
  'brick',
  'question',
  'used',
  'hard',
  'pipeTop',
  'pipeBody',
  'flagPole',
  'flag',
  'castle',
  'eyesShut',
  'sweat',
  'star',
] as const

export const FALLBACK_COLOR: Record<string, string> = {
  face: '#f0c9a4',
  heroSmallIdle: '#4bc0ae',
  heroSmallWalk1: '#4bc0ae',
  heroSmallWalk2: '#4bc0ae',
  heroSmallWalk3: '#4bc0ae',
  heroSmallWalk4: '#4bc0ae',
  heroSmallJump: '#4bc0ae',
  heroSmallSkid: '#4bc0ae',
  heroBigIdle: '#4bc0ae',
  heroBigWalk1: '#4bc0ae',
  heroBigJump: '#4bc0ae',
  broccoli0: '#3f8f4e',
  broccoli1: '#3f8f4e',
  broccoliSquash: '#2e6b3a',
  soupCrouch: '#24402c',
  soupJump: '#24402c',
  crocodile0: '#4f8a3b',
  crocodile1: '#4f8a3b',
  peach: '#f2795c',
  ball0: '#ffffff',
  ball1: '#ffffff',
  ball2: '#ffffff',
  ball3: '#ffffff',
  coin0: '#e8b52a',
  coin1: '#e8b52a',
  coin2: '#e8b52a',
  coin3: '#e8b52a',
  ground: '#a85c30',
  brick: '#8f4d24',
  question: '#f2b134',
  used: '#9aa3ad',
  hard: '#9aa3ad',
  pipeTop: '#3fae52',
  pipeBody: '#2e8b3e',
  flagPole: '#4a4a4a',
  flag: '#e0453c',
  castle: '#b0644a',
  eyesShut: '#14110f',
  sweat: '#7ecbf5',
  star: '#ffe066',
}

export function frame(data: AtlasData, name: string): FrameRect | null {
  return data.frames[name] ?? null
}

/** 실패해도 예외를 던지지 않는다. image가 null이면 렌더러가 폴백을 그린다. */
export async function loadAtlas(data: AtlasData, baseUrl: string): Promise<LoadedAtlas> {
  try {
    const image = await new Promise<HTMLImageElement>((resolve, reject) => {
      const img = new Image()
      img.onload = () => resolve(img)
      img.onerror = () => reject(new Error('스프라이트 시트 로드 실패'))
      img.src = `${baseUrl}${data.sheet}`
    })
    return { data, image }
  } catch {
    console.warn('스프라이트 시트를 못 읽었다. 단색 사각형으로 그린다.')
    return { data, image: null }
  }
}
