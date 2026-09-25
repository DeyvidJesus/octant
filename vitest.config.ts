import { defineConfig } from 'vitest/config'
import path from 'node:path'

export default defineConfig({
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      // The server-only email package. Aliased (rather than relying on the workspace symlink) so the
      // same specifier resolves identically in vitest, in tsc and in the esbuild function bundler.
      '@octant/email': path.resolve(__dirname, './packages/email/src'),
    },
  },
  test: {
    // Default to node; component tests opt into happy-dom with a `// @vitest-environment happy-dom` docblock.
    environment: 'node',
    include: ['src/**/*.test.ts', 'src/**/*.test.tsx', 'packages/*/src/**/*.test.ts', 'packages/*/src/**/*.test.tsx'],
    setupFiles: ['./src/test/setup.ts'],
  },
})
