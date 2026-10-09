/// <reference types="vitest/config" />
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { devClientStubPlugin } from './tooling/devClientStub.ts'
import { devFixtureModelsPlugin } from './tooling/devFixtureModels.ts'
import { devHost, isE2EServer } from './tooling/devHost.ts'
import { resolveDevPort } from './tooling/devPort.ts'
import { outputDuplicateGuardPlugin } from './tooling/outputDuplicateGuard.ts'
import { assetNamePattern, hashCharacters, scriptNamePattern } from './tooling/outputNaming.ts'
import { threeBuildGuardPlugin } from './tooling/threeBuildGuard.ts'
import { siteHeadPlugin } from './tooling/siteHead.ts'
import { unitTestGlobs } from './tooling/testRoots.ts'

const port = resolveDevPort(process.env)
const e2eServer = isE2EServer(process.env)

export default defineConfig({
  plugins: [
    react(),
    siteHeadPlugin(),
    // The production build ships every payload once: the written output,
    // public copies included, fails the build on any two files with the
    // same bytes (tooling/outputDuplicateGuard.ts).
    outputDuplicateGuardPlugin(),
    // The app build holds one three build (the resolve alias below): a
    // module graph that still reaches the classic three build, or an import
    // the webgpu build does not export, fails the build and names it
    // (tooling/threeBuildGuard.ts).
    threeBuildGuardPlugin(),
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
    // One three build for the whole app: every 'three' import, ours and the
    // packages', resolves to the webgpu build whose re-exports the app's own
    // code imports. Both builds share their classes through three.core.js;
    // what the classic entry adds is its renderer machinery, about 335 kB of
    // code the app never instantiates, so aliasing the entry out keeps that
    // code out of the bundle. The build guard (tooling/threeBuildGuard.ts)
    // fails the build if a module graph still reaches the classic build, and
    // on any import the webgpu build does not export, which the alias would
    // otherwise turn into a silent undefined.
    alias: [{ find: /^three$/, replacement: 'three/webgpu' }],
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
  build: {
    // Every bundled file carries a content hash in its name; the deploy check
    // reads the same pattern to tell a hashed file from a stable one.
    rolldownOptions: {
      output: {
        entryFileNames: scriptNamePattern,
        chunkFileNames: scriptNamePattern,
        assetFileNames: assetNamePattern,
        hashCharacters,
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
