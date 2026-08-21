import tsParser from '@typescript-eslint/parser'
import importPlugin from 'eslint-plugin-import'

// 스펙 §3.1 — 순수 계층은 브라우저 의존 계층을 import할 수 없다.
// storage.ts 는 디렉터리가 아니라 루트 파일이지만 window 를 만지므로 함께 막는다.
// 순수 모듈이 이걸 import하면 node 환경 테스트가 전부 깨진다.
const SHELL = ['./src/render', './src/ui', './src/core', './src/storage.ts']
const PURE = ['./src/engine', './src/world', './src/game', './src/levels']

export default [
  {
    ignores: ['dist/**', 'node_modules/**', 'tools/**', '.superpowers/**'],
  },
  {
    files: ['src/**/*.ts', 'tests/**/*.ts'],
    languageOptions: {
      parser: tsParser,
      ecmaVersion: 2022,
      sourceType: 'module',
    },
    plugins: { import: importPlugin },
    settings: {
      'import/resolver': {
        typescript: { alwaysTryTypes: true },
      },
    },
    rules: {
      'import/no-restricted-paths': ['error', {
        zones: PURE.flatMap((target) =>
          SHELL.map((from) => ({
            target,
            from,
            message: '순수 계층은 브라우저 의존 계층을 import할 수 없다 (스펙 §3.1)',
          })),
        ),
      }],
    },
  },
]
