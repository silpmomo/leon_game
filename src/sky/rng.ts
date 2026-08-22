/**
 * 결정적 난수.
 *
 * `Math.random()` 을 쓰면 같은 입력으로 같은 판이 재현되지 않아
 * 골든 리플레이 테스트가 성립하지 않는다. 상태를 state.seed 에 들고 다닌다.
 */

/** [0,1) 을 돌려주고 다음 seed 를 함께 준다 */
export function next(seed: number): [number, number] {
  const s = (Math.imul(seed, 1103515245) + 12345) & 0x7fffffff
  return [s / 0x80000000, s]
}

/** 상태를 들고 다니기 귀찮은 곳에서 쓰는 얇은 래퍼 */
export type Rng = { f: () => number; range: (a: number, b: number) => number; seed: number }

export function makeRng(seed: number): Rng {
  let s = seed || 1
  const r: Rng = {
    f(): number {
      const [v, ns] = next(s)
      s = ns
      r.seed = ns
      return v
    },
    range(a: number, b: number): number {
      return a + r.f() * (b - a)
    },
    seed,
  }
  return r
}
