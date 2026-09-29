/// <reference types="vitest/config" />
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { extensionGlob, sourceExtensions, unitTestMarker } from './tooling/extensions.ts'
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
  test: {
    environment: 'node',
    // The test include and every lint files glob read the same extension
    // list and marker data, so what typechecks, what lints and what runs as
    // a test cannot drift apart. Vitest includes the unit marker only: the
    // spec marker belongs to Playwright.
    include: ['src', 'tooling', 'tests/e2e'].map(
      (folder) => `${folder}/**/*.${unitTestMarker}.${extensionGlob(sourceExtensions)}`,
    ),
    // The gate runs locally, so a stray .only must fail it, not pass quietly.
    allowOnly: false,
  },
})
