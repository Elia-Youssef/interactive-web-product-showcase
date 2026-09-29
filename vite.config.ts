import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { resolveDevPort } from './tooling/devPort.ts'

const port = resolveDevPort(process.env)

export default defineConfig({
  plugins: [react()],
  resolve: {
    tsconfigPaths: true,
  },
  // Breakpoints are @custom-media rules in src/styles/tokens.css; only the
  // lightningcss transformer can resolve them (CSS Level 5 draft syntax).
  css: {
    transformer: 'lightningcss',
    lightningcss: {
      drafts: {
        customMedia: true,
      },
    },
  },
  server: {
    port,
    strictPort: true,
  },
  preview: {
    port,
    strictPort: true,
  },
})
