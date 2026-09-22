import { configDefaults, defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    environment: 'node',
    fileParallelism: false,
    testTimeout: 20000,
    hookTimeout: 30000,
    include: ['**/*.test.ts'],
    exclude: [...configDefaults.exclude, '**/node_modules/**']
  }
})
