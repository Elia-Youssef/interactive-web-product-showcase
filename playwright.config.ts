import { defineConfig } from '@playwright/test'
import { extensionGlob, sourceExtensions, specFileMarker } from './tooling/extensions.ts'
import { e2eBaseURL, e2eServer } from './tooling/devHost.ts'
import { gateProofProject, matrixAssignments } from './tests/e2e/matrix.ts'
import type { MatrixAssignment } from './tests/e2e/matrix.ts'
import { testBudgetMs } from './tests/e2e/budgets.ts'
import { e2eViewport } from './tests/e2e/e2eViewport.ts'
import { resolveDevPort } from './tooling/devPort.ts'
import { resolveE2EWorkers } from './tooling/e2eWorkers.ts'
import { resolveE2ETier, specPattern, specSelection } from './tests/e2e/tiers.ts'
import type { SpecSelection } from './tests/e2e/tiers.ts'

const port = resolveDevPort(process.env)
const baseURL = e2eBaseURL(port)

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
    hostsVisualBaselines: row.hostsVisualBaselines,
  }
}

const proofs = gateProofProject()
const tierMode = resolveE2ETier(process.env)

// The tier and family tables decide which specs a project runs; the gate
// proofs stay out of every matrix project, whatever the tier.
function specOptions(selection: SpecSelection) {
  switch (selection.kind) {
    case 'all':
      return { testIgnore: [proofs.testMatch] }
    case 'only':
      return { testMatch: [specPattern(selection.specs)], testIgnore: [proofs.testMatch] }
    case 'except':
      return { testIgnore: [proofs.testMatch, specPattern(selection.specs)] }
  }
}

export default defineConfig({
  testDir: './tests/e2e',
  testMatch: SPEC_GLOB,
  // The per-test timeout derives from the suite's budget module: a
  // single-load test's budget, which is what a test that needs more must
  // derive its own limit against (tests/e2e/budgets.ts).
  timeout: testBudgetMs({ productLoads: 1 }),
  // The browser matrix runs fully parallel within the worker cap. Only the
  // gate proofs pin the spec file load order, and their project alone drops
  // back to one worker.
  fullyParallel: true,
  workers: resolveE2EWorkers(process.env),
  // The gate runs locally, so a stray .only must fail it everywhere, not
  // only on CI.
  forbidOnly: true,
  reporter: [['list']],
  use: {
    baseURL,
    viewport: e2eViewport,
    screenshot: { mode: 'only-on-failure', fullPage: true },
  },
  webServer: {
    command: `pnpm exec vite --port ${port} --strictPort`,
    url: baseURL,
    reuseExistingServer: false,
    // The mark that keys the server's e2e configuration: the loopback host
    // and the no-HMR client stub (tooling/devHost.ts, tooling/devClientStub.ts).
    env: { [e2eServer.variable]: e2eServer.value },
  },
  projects: [
    ...matrixAssignments().map((row) => ({
      name: row.project,
      ...specOptions(specSelection(row.project, tierMode)),
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
