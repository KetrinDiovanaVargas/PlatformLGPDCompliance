import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    environment: 'node',
    globals: true,
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      include: ['server/lib/**/*.mjs', 'server/routes/**/*.mjs'],
      exclude: ['node_modules/', 'tests/']
    }
  }
})
