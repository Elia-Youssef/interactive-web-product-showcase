/// <reference types="vitest/config" />
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { resolveDevPort } from './tooling/devPort.ts'
import { unitTestGlobs } from './tooling/testRoots.ts'

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
  test: {
    environment: 'node',
    // The unit test roots, marker and extensions come from tooling/, so what
    // lints and what runs as a test cannot drift apart, and a guard test
    // fails on any unit test file outside these roots. Vitest includes the
    // unit marker only: the spec marker belongs to Playwright.
    include: unitTestGlobs(),
    // The gate runs locally, so a stray .only must fail it, not pass quietly.
    allowOnly: false,
  },
})
