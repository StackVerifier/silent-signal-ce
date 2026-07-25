import { defineConfig } from 'vitest/config'
import { resolve } from 'node:path'

export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
  },
  resolve: {
    alias: {
      '@': resolve(import.meta.dirname, '.'),
      // `server-only` exists to throw when a client bundle pulls it in. Tests
      // run in Node, which is exactly where these modules belong, so the guard
      // has nothing to protect and is stubbed out.
      'server-only': resolve(import.meta.dirname, 'tests/stubs/server-only.ts'),
    },
  },
})
