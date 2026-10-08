// Which specs run on which projects, and which products the product
// independent specs cover, as data. The run has two tiers of projects: the
// full tier runs every spec, the smoke tier runs the smoke specs only, which
// prove the launch of the channel, its brand, the automatic backend
// selection, a product reaching ready, routing and the failure channel. The
// layout family (DOM geometry, independent of the rendering backend) runs
// once per engine family on the full tier. VIEWER_E2E_TIER=full lifts all
// of it: every spec on every project and every product, the check before a
// release.
import { resolveEnvChoice } from '../../tooling/envChoice.ts'
import { specFileMarker } from '../../tooling/extensions.ts'

export const e2eTier = {
  variable: 'VIEWER_E2E_TIER',
  default: 'tiered',
  choices: ['tiered', 'full'],
} as const

export type E2ETierMode = (typeof e2eTier.choices)[number]

export function resolveE2ETier(env: Record<string, string | undefined>): E2ETierMode {
  return resolveEnvChoice(e2eTier, env)
}

export type ProjectTier = 'full' | 'smoke'

export type ProjectProfile = {
  readonly tier: ProjectTier
  // Whether the layout family runs on this project: one project per engine
  // family, since the layout does not depend on the rendering backend.
  readonly hostsLayout: boolean
}

// Firefox and WebKit ship no WebGPU in their Playwright builds, so their
// automatic projects land on the same backend as their forced-fallback
// ones, and msedge is the same engine as chrome: those four projects run
// the smoke specs only.
export const projectProfiles: Readonly<Record<string, ProjectProfile>> = {
  'chrome-auto': { tier: 'full', hostsLayout: true },
  'chrome-webgl2': { tier: 'full', hostsLayout: false },
  'firefox-webgl2': { tier: 'full', hostsLayout: true },
  'webkit-webgl2': { tier: 'full', hostsLayout: true },
  'msedge-auto': { tier: 'smoke', hostsLayout: false },
  'msedge-webgl2': { tier: 'smoke', hostsLayout: false },
  'firefox-auto': { tier: 'smoke', hostsLayout: false },
  'webkit-auto': { tier: 'smoke', hostsLayout: false },
}

// A spec belongs to one family; a spec the table does not name is general
// and runs on the full tier.
export type SpecFamily = 'smoke' | 'layout'

export const specFamilies: Readonly<Record<string, SpecFamily>> = {
  smoke: 'smoke',
  devClient: 'smoke',
  productReady: 'smoke',
  productLocalhost: 'smoke',
  stageCanvas: 'smoke',
  stageModel: 'smoke',
  routing: 'smoke',
  failure: 'smoke',
  cameraHome: 'smoke',
  hotspotCardPlacement: 'layout',
  hotspotCardDock: 'layout',
  hotspotCardWidth: 'layout',
  hotspotCardBreakpoints: 'layout',
  layout: 'layout',
  layoutVisual: 'layout',
  'product-panel': 'layout',
  linkTabbing: 'layout',
  liveRegion: 'layout',
  measurementFocus: 'layout',
}

function specsOf(family: SpecFamily): readonly string[] {
  return Object.entries(specFamilies)
    .filter(([, specFamily]) => specFamily === family)
    .map(([spec]) => spec)
}

export type SpecSelection =
  | { readonly kind: 'all' }
  | { readonly kind: 'only'; readonly specs: readonly string[] }
  | { readonly kind: 'except'; readonly specs: readonly string[] }

export function specSelection(project: string, mode: E2ETierMode): SpecSelection {
  if (mode === 'full') {
    return { kind: 'all' }
  }
  const profile = projectProfiles[project]
  if (profile === undefined) {
    throw new Error(`project '${project}' has no tier: add it to projectProfiles`)
  }
  if (profile.tier === 'smoke') {
    return { kind: 'only', specs: specsOf('smoke') }
  }
  return profile.hostsLayout ? { kind: 'all' } : { kind: 'except', specs: specsOf('layout') }
}

// The spec file names as one path pattern, for the runner's match options.
export function specPattern(specs: readonly string[]): RegExp {
  for (const spec of specs) {
    if (!/^[A-Za-z0-9-]+$/.test(spec)) {
      throw new Error(`spec name '${spec}' must be letters, digits and hyphens only`)
    }
  }
  return new RegExp(`[\\\\/](${specs.join('|')})\\.${specFileMarker}\\.`)
}

// The products the product independent specs cover: the two lowest product
// numbers in the tiered run, every product in the full run. The rule reads
// the collection's own numbering, never a slug.
export const productSampleSize = 2

export function sampleProducts<Item extends { readonly number: number }>(
  products: readonly Item[],
  mode: E2ETierMode,
): readonly Item[] {
  if (mode === 'full') {
    return products
  }
  return [...products].sort((a, b) => a.number - b.number).slice(0, productSampleSize)
}
