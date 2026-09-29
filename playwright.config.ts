import { defineConfig } from '@playwright/test'
import { extensionGlob, sourceExtensions, specFileMarker } from './tooling/extensions.ts'
import { gateProofProject, matrixAssignments } from './tests/e2e/matrix.ts'
import type { MatrixAssignment } from './tests/e2e/matrix.ts'
import { resolveDevPort } from './tooling/devPort.ts'

const port = resolveDevPort(process.env)
const baseURL = `http://localhost:${port}`

// Playwright runs the spec marker only: the unit marker belongs to Vitest.
const SPEC_GLOB = `**/*.${specFileMarker}.${extensionGlob(sourceExtensions)}`

// Every project carries its matrix row, so the fixtures can hold the launch
// to it. Both the matrix projects and the gate-proof project read this one
// mapping.
function projectOptions(row: MatrixAssignment) {
  return {
    browserName: row.browserName,
    ...(row.channel !== undefined
      ? { channel: row.channel.name, expectedChannel: row.channel }
      : {}),
    backendPath: row.backendPath,
    expectedBackend: row.expectedBackend,
    expectedBrowserName: row.browserName,
  }
}

const proofs = gateProofProject()

export default defineConfig({
  testDir: './tests/e2e',
  testMatch: SPEC_GLOB,
  // The browser matrix runs fully parallel. Only the gate proofs pin the
  // spec file load order, and their project alone drops back to one worker.
  fullyParallel: true,
  // The gate runs locally, so a stray .only must fail it everywhere, not
  // only on CI.
  forbidOnly: true,
  reporter: [['list']],
  use: {
    baseURL,
    screenshot: { mode: 'only-on-failure', fullPage: true },
  },
  webServer: {
    command: `pnpm exec vite --port ${port} --strictPort`,
    url: baseURL,
    reuseExistingServer: false,
  },
  projects: [
    ...matrixAssignments().map((row) => ({
      name: row.project,
      testIgnore: [proofs.testMatch],
      use: projectOptions(row),
    })),
    {
      name: proofs.name,
      testMatch: [proofs.testMatch],
      workers: 1,
      fullyParallel: false,
      use: projectOptions(proofs.assignment),
    },
  ],
})
