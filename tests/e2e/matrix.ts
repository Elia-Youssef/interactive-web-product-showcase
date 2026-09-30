// The smoke matrix as two data tables: the browsers and the backend modes.
// The Playwright projects are their cross product, so every project carries a
// real browserName, and the fixtures hold the launch to it.
import { backendForceWebGLValue, backendQueryParam } from '../../src/lib/renderer/request'
import type { RendererBackend } from '../../src/lib/renderer/backend'

export type BrowserName = 'chromium' | 'firefox' | 'webkit'

export type ChannelSpec = {
  readonly name: 'chrome' | 'msedge'
  // The brand name this channel must advertise in
  // navigator.userAgentData.brands. A bundled Chromium build never claims
  // the branded name, so the brand is the proof the channel really launched.
  readonly brand: 'Google Chrome' | 'Microsoft Edge'
}

type BrowserRow = {
  readonly name: string
  readonly browserName: BrowserName
  readonly channel?: ChannelSpec
  // The backend the page is expected to land on under automatic selection.
  // Firefox and WebKit ship no WebGPU in their Playwright builds, so their
  // automatic projects expect the documented WebGL2 fallback.
  readonly autoBackend: RendererBackend
  // The browser row that hosts the gate-proof project on its launch.
  readonly hostsGateProofs?: boolean
  // The browser row that hosts visual baselines.
  readonly hostsVisualBaselines?: boolean
}

export const browsers: readonly BrowserRow[] = [
  {
    name: 'chrome',
    browserName: 'chromium',
    channel: { name: 'chrome', brand: 'Google Chrome' },
    autoBackend: 'webgpu',
    hostsGateProofs: true,
    hostsVisualBaselines: true,
  },
  {
    name: 'msedge',
    browserName: 'chromium',
    channel: { name: 'msedge', brand: 'Microsoft Edge' },
    autoBackend: 'webgpu',
  },
  { name: 'firefox', browserName: 'firefox', autoBackend: 'webgl2' },
  { name: 'webkit', browserName: 'webkit', autoBackend: 'webgl2' },
]

type ModeRow = {
  readonly name: string
  readonly path: string
  readonly expectedBackend: (browser: BrowserRow) => RendererBackend
  // The mode that hosts the specs run once per browser row rather than once
  // per project: the gate proofs and the visual baselines.
  readonly primary?: boolean
}

// The forced fallback path is built from the request parser's own data, so
// the URL the matrix drives and the contract the app parses cannot drift.
const forcedWebGL2Path = `/?${backendQueryParam}=${backendForceWebGLValue}`

export const modes: readonly ModeRow[] = [
  { name: 'auto', path: '/', expectedBackend: (browser) => browser.autoBackend, primary: true },
  { name: 'webgl2', path: forcedWebGL2Path, expectedBackend: () => 'webgl2' },
]

function primaryMode(): ModeRow {
  const mode = modes.find((candidate) => candidate.primary === true)
  if (mode === undefined) {
    throw new Error('no backend mode is primary: flag one with primary')
  }
  return mode
}

export type MatrixAssignment = {
  readonly project: string
  readonly browserName: BrowserName
  readonly channel?: ChannelSpec
  readonly backendPath: string
  readonly expectedBackend: RendererBackend
  readonly hostsVisualBaselines: boolean
}

export function matrixAssignments(): readonly MatrixAssignment[] {
  return browsers.flatMap((browser) =>
    modes.map((mode) => ({
      project: `${browser.name}-${mode.name}`,
      browserName: browser.browserName,
      ...(browser.channel !== undefined ? { channel: browser.channel } : {}),
      backendPath: mode.path,
      expectedBackend: mode.expectedBackend(browser),
      hostsVisualBaselines: browser.hostsVisualBaselines === true && mode.primary === true,
    })),
  )
}

// The gate-proof specs prove the console gate against itself and depend on
// the order spec files load in, so they run in one project on one worker,
// whatever the browser matrix does around them. The browser row flagged in
// the table hosts that project, from this same data.
export type GateProofProject = {
  readonly name: string
  readonly testMatch: RegExp
  readonly assignment: MatrixAssignment
}

export function gateProofProject(): GateProofProject {
  const host = browsers.find((browser) => browser.hostsGateProofs === true)
  if (host === undefined) {
    throw new Error('no browser row hosts the gate proofs: flag one with hostsGateProofs')
  }
  const mode = primaryMode()
  return {
    name: 'gate-proof',
    // The spec file names sort, so the first-file spec always loads before
    // its twin on the one worker.
    testMatch: /console-gate-/,
    assignment: {
      project: 'gate-proof',
      browserName: host.browserName,
      ...(host.channel !== undefined ? { channel: host.channel } : {}),
      backendPath: mode.path,
      expectedBackend: mode.expectedBackend(host),
      hostsVisualBaselines: false,
    },
  }
}
