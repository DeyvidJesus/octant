import { defineConfig } from 'vitest/config'
import path from 'node:path'

export default defineConfig({
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      // Aliased like in tsc and the function bundler, instead of relying on the workspace symlink.
      '@octant/email': path.resolve(__dirname, './packages/email/src'),
    },
  },
  test: {
    // Default to node; component tests opt into happy-dom with a `// @vitest-environment happy-dom` docblock.
    environment: 'node',
    include: [
      'src/**/*.test.ts',
      'src/**/*.test.tsx',
      'packages/*/src/**/*.test.ts',
      'packages/*/src/**/*.test.tsx',
      'supabase/tests/**/*.test.ts',
    ],
    setupFiles: ['./src/test/setup.ts'],
  },
})
