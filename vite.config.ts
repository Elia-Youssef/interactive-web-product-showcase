/// <reference types="vitest/config" />
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { devClientStubPlugin } from './tooling/devClientStub.ts'
import { devFixtureModelsPlugin } from './tooling/devFixtureModels.ts'
import { devHost, isE2EServer } from './tooling/devHost.ts'
import { resolveDevPort } from './tooling/devPort.ts'
import { unitTestGlobs } from './tooling/testRoots.ts'

const port = resolveDevPort(process.env)
const e2eServer = isE2EServer(process.env)

export default defineConfig({
  plugins: [
    react(),
    // The e2e server serves the stub client in place of Vite's dev client:
    // its modules import the client for style injection alone, and nothing
    // in an e2e run hot-updates, so the client's WebSocket and its
    // reconnect polling would be pure risk on the console gate.
    ...(e2eServer ? [devClientStubPlugin()] : []),
    // The dev server answers a fixture product's model at the model URL
    // every product loads by, from tests/fixtures/products; the build and
    // the preview of dist never carry a fixture model.
    devFixtureModelsPlugin(),
  ],
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
    // The e2e server binds the one literal loopback address every e2e page
    // opens (tooling/devHost.ts), and runs with HMR and its WebSocket
    // endpoint off: nothing in an e2e run hot-updates, and a dev server by
    // hand, without the e2e mark, keeps Vite's defaults.
    ...(e2eServer
      ? {
          host: devHost.address,
          hmr: false,
          ws: false,
        }
      : {}),
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
