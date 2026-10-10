import { readdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { matrixAssignments } from './matrix'
import {
  productSampleSize,
  projectProfiles,
  resolveE2ETier,
  sampleProducts,
  specFamilies,
  specPattern,
  specSelection,
} from './tiers'
import type { E2ETierMode } from './tiers'

const projects = matrixAssignments().map((row) => row.project)
const specDir = fileURLToPath(new URL('.', import.meta.url))
const specFiles = readdirSync(specDir).filter((name) => name.includes('.spec.'))
const specNames = specFiles.map((name) => name.replace('.spec.ts', ''))

function runs(project: string, spec: string, mode: E2ETierMode): boolean {
  const selection = specSelection(project, mode)
  const path = `${specDir}${spec}.spec.ts`
  switch (selection.kind) {
    case 'all':
      return true
    case 'only':
      return specPattern(selection.specs).test(path)
    case 'except':
      return !specPattern(selection.specs).test(path)
  }
}

describe('the project profiles', () => {
  it('cover exactly the matrix projects', () => {
    expect(Object.keys(projectProfiles).sort()).toEqual([...projects].sort())
  })

  it('keep four full projects and the layout family on one project per engine family', () => {
    const full = projects.filter((name) => projectProfiles[name]?.tier === 'full')
    expect(full.sort()).toEqual(['chrome-auto', 'chrome-webgl2', 'firefox-webgl2', 'webkit-webgl2'])
    const layout = projects.filter((name) => projectProfiles[name]?.hostsLayout === true)
    expect(layout.sort()).toEqual(['chrome-auto', 'firefox-webgl2', 'webkit-webgl2'])
  })
})

describe('the spec families', () => {
  it('name only spec files that exist', () => {
    for (const spec of Object.keys(specFamilies)) {
      expect(specNames, spec).toContain(spec)
    }
  })

  it('keep the decided smoke and layout sets, so no spec leaves its family unnoticed', () => {
    const family = (name: string) =>
      Object.keys(specFamilies)
        .filter((spec) => specFamilies[spec] === name)
        .sort()
    expect(family('smoke')).toEqual([
      'cameraHome',
      'devClient',
      'failure',
      'productLocalhost',
      'productReady',
      'routing',
      'smoke',
      'stageCanvas',
      'stageModel',
    ])
    expect(family('layout')).toEqual([
      'hotspotCardBreakpoints',
      'hotspotCardDock',
      'hotspotCardPlacement',
      'hotspotCardSheet',
      'hotspotCardWidth',
      'layout',
      'layoutVisual',
      'linkTabbing',
      'liveRegion',
      'measurementFocus',
      'product-panel',
      'productEyebrow',
      'reflow',
      'socialCardFrame',
      'topLayerPlacement',
    ])
  })
})

describe('specSelection', () => {
  it('runs every spec on every project under the full switch', () => {
    for (const project of projects) {
      expect(specSelection(project, 'full')).toEqual({ kind: 'all' })
    }
  })

  it('runs the smoke specs only on a smoke project', () => {
    for (const spec of specNames) {
      expect(runs('msedge-auto', spec, 'tiered'), spec).toBe(specFamilies[spec] === 'smoke')
    }
  })

  it('runs the smoke specs on every project', () => {
    for (const project of projects) {
      expect(runs(project, 'smoke', 'tiered'), project).toBe(true)
      expect(runs(project, 'routing', 'tiered'), project).toBe(true)
    }
  })

  it('runs the layout family on the engine family hosts only', () => {
    for (const spec of Object.keys(specFamilies).filter(
      (name) => specFamilies[name] === 'layout',
    )) {
      expect(runs('chrome-auto', spec, 'tiered'), spec).toBe(true)
      expect(runs('firefox-webgl2', spec, 'tiered'), spec).toBe(true)
      expect(runs('webkit-webgl2', spec, 'tiered'), spec).toBe(true)
      expect(runs('chrome-webgl2', spec, 'tiered'), spec).toBe(false)
      expect(runs('msedge-webgl2', spec, 'tiered'), spec).toBe(false)
    }
  })

  it('runs a general spec on the full tier and nowhere else', () => {
    for (const project of projects) {
      for (const spec of ['finishes', 'routerLifecycle']) {
        expect(runs(project, spec, 'tiered'), `${project}: ${spec}`).toBe(
          projectProfiles[project]?.tier === 'full',
        )
      }
    }
  })

  it('rejects a project without a profile', () => {
    expect(() => specSelection('nope', 'tiered')).toThrow("project 'nope' has no tier")
  })

  it('does not confuse a spec name with a longer one', () => {
    expect(specPattern(['layout']).test('/x/layoutVisual.spec.ts')).toBe(false)
    expect(specPattern(['layout']).test('C:\\x\\layout.spec.ts')).toBe(true)
  })
})

describe('sampleProducts', () => {
  const products = [{ number: 3 }, { number: 1 }, { number: 5 }, { number: 2 }]

  it('keeps the lowest numbers in the tiered run', () => {
    expect(sampleProducts(products, 'tiered')).toEqual([{ number: 1 }, { number: 2 }])
    expect(sampleProducts(products, 'tiered')).toHaveLength(productSampleSize)
  })

  it('keeps a small collection whole', () => {
    expect(sampleProducts([{ number: 1 }], 'tiered')).toEqual([{ number: 1 }])
  })

  it('keeps every product under the full switch', () => {
    expect(sampleProducts(products, 'full')).toEqual(products)
  })
})

describe('resolveE2ETier', () => {
  it('defaults to the tiered run', () => {
    expect(resolveE2ETier({})).toBe('tiered')
  })

  it('accepts the full switch and rejects anything else', () => {
    expect(resolveE2ETier({ VIEWER_E2E_TIER: 'full' })).toBe('full')
    expect(() => resolveE2ETier({ VIEWER_E2E_TIER: 'all' })).toThrow('VIEWER_E2E_TIER')
  })
})
