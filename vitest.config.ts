import { defineConfig } from 'vitest/config'
import path from 'path'

export default defineConfig({
  test: {
    environment: 'node',
    globals: true,
    hookTimeout: 30000,
    testTimeout: 30000,
  },
  resolve: {
    alias: [
      { find: /^@\/db\//, replacement: path.resolve(__dirname, 'db') + '/' },
      { find: /^@\//, replacement: path.resolve(__dirname, 'src') + '/' },
    ],
  },
})
