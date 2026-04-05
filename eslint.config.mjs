// eslint.config.mjs
// Flat config for ESLint 9+. Uses eslint-config-next which bundles
// @next/eslint-plugin-next, eslint-plugin-react, eslint-plugin-react-hooks,
// and typescript-eslint with sensible Next.js defaults.

import nextConfig from 'eslint-config-next'

export default [
  ...nextConfig,
  {
    ignores: [
      '.next/**',
      'node_modules/**',
      'dist/**',
    ],
  },
]
