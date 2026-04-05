import { defineConfig } from 'vitest/config'
import tsconfigPaths from 'vite-tsconfig-paths'

export default defineConfig({
  // @ts-ignore
  plugins: [tsconfigPaths()],
  test: {
    environment: 'node',
  },
})
