import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { resolveDevPort } from './tooling/devPort.ts'

const port = resolveDevPort(process.env)

export default defineConfig({
  plugins: [react()],
  resolve: {
    tsconfigPaths: true,
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
