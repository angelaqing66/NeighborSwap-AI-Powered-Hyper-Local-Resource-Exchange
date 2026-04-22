import { defineConfig, configDefaults } from 'vitest/config'
import tsconfigPaths from 'vite-tsconfig-paths'

export default defineConfig({
  // @ts-ignore
  plugins: [tsconfigPaths()],
  test: {
    exclude: [...configDefaults.exclude, 'e2e/**', '.claude/**'],
    environment: 'node',
  },
})
