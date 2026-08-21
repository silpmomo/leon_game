import { TUNING } from '../engine/tuning'

type Mutable = { -readonly [K in keyof typeof TUNING]: number }

const RANGES: Partial<Record<keyof typeof TUNING, [number, number, number]>> = {
  walkMax: [40, 200, 1],
  runMax: [80, 320, 1],
  runRampMs: [200, 4000, 50],
  accel: [100, 900, 10],
  decel: [100, 1200, 10],
  skidDecel: [200, 2000, 20],
  airAccel: [50, 600, 10],
  jumpVel: [-520, -160, 5],
  gravityRise: [300, 1600, 20],
  gravityFall: [600, 2600, 20],
  jumpCut: [0.1, 1, 0.05],
  maxFall: [200, 600, 10],
  coyoteMs: [0, 240, 5],
  jumpBufferMs: [0, 320, 5],
  cornerNudge: [0, 8, 1],
  stompGrace: [0, 12, 1],
}

/**
 * DOM 오버레이로 만든다. 캔버스 위에 그리면 슬라이더 조작이 게임 터치 입력과
 * 섞인다. TUNING 은 as const 지만 런타임에는 그냥 객체다 — 개발 빌드 전용
 * 통로이고 게임 코드는 여전히 읽기만 한다.
 */
export function mountTuningPanel(): void {
  const t = TUNING as unknown as Mutable

  const panel = document.createElement('div')
  panel.style.cssText = [
    'position:fixed',
    'right:0',
    'top:0',
    'z-index:99',
    'max-height:100vh',
    'overflow-y:auto',
    'background:rgba(10,12,18,.9)',
    'color:#cfe',
    'font:10px/1.5 monospace',
    'padding:6px 8px',
    'width:196px',
    'touch-action:auto',
  ].join(';')

  const title = document.createElement('div')
  title.textContent = '?debug=1 — 상수 튜닝'
  title.style.cssText = 'font-weight:700;margin-bottom:4px;color:#7fd'
  panel.append(title)

  const entries = Object.entries(RANGES) as [keyof Mutable, [number, number, number]][]
  for (const [key, [min, max, step]] of entries) {
    const row = document.createElement('label')
    row.style.cssText = 'display:block;margin-bottom:3px'

    const out = document.createElement('span')
    out.textContent = String(t[key])
    out.style.cssText = 'float:right;color:#fd7'

    const input = document.createElement('input')
    input.type = 'range'
    input.min = String(min)
    input.max = String(max)
    input.step = String(step)
    input.value = String(t[key])
    input.style.cssText = 'width:100%;margin:0'
    input.addEventListener('input', () => {
      t[key] = Number(input.value)
      out.textContent = input.value
    })

    row.append(document.createTextNode(key), out, input)
    panel.append(row)
  }

  const dump = document.createElement('button')
  dump.textContent = 'tuning.ts 값 복사'
  dump.style.cssText = 'width:100%;margin-top:4px;font:10px monospace'
  dump.addEventListener('click', () => {
    const text = entries.map(([k]) => `  ${String(k)}: ${t[k]},`).join('\n')
    void navigator.clipboard?.writeText(text)
    dump.textContent = '복사됨 — tuning.ts에 붙여라'
  })
  panel.append(dump)

  document.body.append(panel)
}
