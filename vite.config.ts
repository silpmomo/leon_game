// vitest/config 에서 defineConfig 를 가져온다.
// vite 의 defineConfig 에는 test 키 타입이 없어 `tsc --noEmit` 이 실패한다.
import { defineConfig } from 'vitest/config'

export default defineConfig({
  base: '/leon_game/',
  test: {
    environment: 'node',
    globals: true,
    include: ['tests/**/*.test.ts'],
  },
})
