import { defineConfig, configDefaults } from 'vitest/config'
import tsconfigPaths from 'vite-tsconfig-paths'

export default defineConfig({
  // @ts-ignore
  plugins: [tsconfigPaths()],
  test: {
    exclude: [...configDefaults.exclude, 'e2e/**', '.claude/**'],
    environment: 'node',
    coverage: {
      provider: 'v8',
      include: [
        'src/actions/**/*.ts',
        'src/lib/agents/**/*.ts',
        'src/lib/getDevStats.ts',
        'src/lib/listings.ts',
        'src/components/chat/TradeStatusPanel.tsx',
      ],
      exclude: ['**/__tests__/**', '**/*.test.ts', '**/*.test.tsx'],
      reporter: ['text', 'json', 'json-summary', 'html'],
      reportsDirectory: './coverage',
      thresholds: {
        lines: 70,
        functions: 70,
        branches: 70,
        statements: 70,
      },
    },
  },
})
