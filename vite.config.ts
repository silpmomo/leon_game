// vitest/config 에서 defineConfig 를 가져온다.
// vite 의 defineConfig 에는 test 키 타입이 없어 `tsc --noEmit` 이 실패한다.
import { defineConfig } from 'vitest/config'

export default defineConfig({
  base: '/leon_game/',
  build: {
    /**
     * 스프라이트 시트를 번들 안에 data URI 로 넣는다.
     *
     * 기본값 4096B 를 넘기면 시트가 별도 파일로 떨어진다. 해시가 붙으니
     * 그것도 캐시상 안전하긴 하지만, 시트와 atlas.json 이 한 파일에 같이
     * 실려 있어야 둘이 어긋날 수 없다. 예전에 이게 어긋나 모든 프레임이
     * 엉뚱한 영역을 읽은 적이 있다. 하늘전투 스프라이트가 붙으면서
     * 시트가 4KB 를 넘었으므로 상한을 올린다.
     */
    assetsInlineLimit: 32_768,
  },
  test: {
    environment: 'node',
    globals: true,
    include: ['tests/**/*.test.ts'],
  },
})
