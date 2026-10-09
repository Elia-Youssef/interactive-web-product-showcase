// The validate checks, over contract documents built in memory with
// @gltf-transform/core (no Blender, no KTX-Software). Every case builds the
// fact its rule reads, runs the check group, and asserts the exact
// violation messages: the report's wording is part of the contract. The
// camera contract check's cases live in validateCameras.test.ts.
import { describe, expect, it } from 'vitest'
import { parseProduct } from '../src/lib/product/index.ts'
import type { Product, ProductInput } from '../src/lib/product/index.ts'
import { readProductStructure } from './structure.ts'
import {
  buildDocument,
  addRootNode,
  cameraContract,
  hangUnreadable,
  nodeNamed,
  type DocumentOptions,
} from './validateFixtures.ts'
import {
  checkBudgets,
  checkEncoding,
  checkExplode,
  checkFinishes,
  checkGeometry,
  checkHotspots,
  checkManifest,
  checkMaterials,
  type BudgetFacts,
  type EncodingFacts,
  type TextureFact,
} from './validateChecks.ts'
import { checkCameras } from './validateCameras.ts'

// The hotspots of the fixture manifest, on the fixture document's parts.
const FIXTURE_HOTSPOTS = ['HS_driver', 'HS_knob']

function buildFixtureDocument(options: DocumentOptions = {}) {
  return buildDocument({ hotspotNames: FIXTURE_HOTSPOTS, ...options })
}

// The manifest every check passes on, parsed through the real schema so the
// checks see exactly what the validate step sees.
const driverHotspot = {
  id: 'driver',
  eyebrow: 'A closer look',
  title: 'Full-range driver',
  bullets: ['Behind the grille'],
} satisfies ProductInput['hotspots'][number]

const knobHotspot = {
  id: 'knob',
  eyebrow: 'On top',
  title: 'Volume knob',
  bullets: ['Machined aluminum'],
} satisfies ProductInput['hotspots'][number]

const fixtureInput = {
  slug: 'fixture-speaker',
  number: 2,
  category: 'Audio',
  brand: 'Sample',
  model: 'Speaker',
  eyebrow: 'Compact speaker',
  tagline: 'A quiet box that fills the room.',
  intro: ['One line.'],
  finishes: [
    { variant: 'sage', label: 'Sage Green', swatch: '#9DB89D' },
    { variant: 'graphite', label: 'Graphite', swatch: '#2B2E2C' },
  ],
  hotspots: [driverHotspot, knobHotspot],
  explode: { clip: 'Explode', label: 'See inside' },
} satisfies ProductInput

function manifestWith(overrides: Partial<ProductInput>): Product {
  return parseProduct({ ...fixtureInput, ...overrides }, 'fixture')
}

const fixture = parseProduct(fixtureInput, 'fixture')

const ktx2Body: TextureFact = {
  label: 'BC_body',
  mimeType: 'image/ktx2',
  dimensions: [1024, 1024],
}

const passingEncoding: EncodingFacts = { textures: [ktx2Body], meshoptCompressed: true }
const passingBudgets: BudgetFacts = { fileBytes: 1000, textures: [ktx2Body], drawCalls: 5 }

describe('the validate checks on a contract document', () => {
  it('passes every check group on the valid document', () => {
    const structure = readProductStructure(buildFixtureDocument())
    expect(checkManifest('fixture-speaker', fixture).status).toBe('pass')
    expect(checkHotspots(fixture, structure)).toEqual({
      name: 'hotspots',
      status: 'pass',
      detail: '2 manifest hotspots',
      violations: [],
      warnings: [],
    })
    expect(checkCameras(fixture, structure, cameraContract).violations).toEqual([])
    expect(checkFinishes(fixture, structure).violations).toEqual([])
    expect(checkMaterials(structure)).toEqual({
      name: 'materials',
      status: 'pass',
      detail: 'no anisotropy textures',
      violations: [],
      warnings: [],
    })
    expect(checkExplode(fixture, structure).violations).toEqual([])
    expect(checkGeometry(structure).status).toBe('pass')
    expect(checkEncoding(passingEncoding).status).toBe('pass')
    expect(checkBudgets(passingBudgets).status).toBe('pass')
  })

  it('reports a manifest hotspot with no HS_ node', () => {
    const manifest = manifestWith({
      hotspots: [
        driverHotspot,
        knobHotspot,
        {
          id: 'dial',
          eyebrow: 'A closer look',
          title: 'A dial that is not there',
          bullets: ['Nowhere'],
        },
      ],
    })
    const result = checkHotspots(manifest, readProductStructure(buildFixtureDocument()))
    expect(result.violations).toEqual([`no HS_dial node for manifest hotspot 'dial'`])
  })

  it('reports an HS_ node parented to a non-PART_ node', () => {
    const doc = buildFixtureDocument()
    const shadow = addRootNode(doc, 'SHADOW')
    const hotspot = nodeNamed(doc, 'HS_driver')
    const parent = hotspot.getParentNode()
    if (parent !== null) {
      parent.removeChild(hotspot)
    }
    shadow.addChild(hotspot)
    const result = checkHotspots(fixture, readProductStructure(doc))
    expect(result.violations).toEqual([
      'hotspot HS_driver is parented to SHADOW, expected a PART_ node',
    ])
  })

  it('reports an HS_ node whose rest position cannot be read', () => {
    const doc = buildFixtureDocument()
    hangUnreadable(doc, 'HS_driver')
    expect(checkHotspots(fixture, readProductStructure(doc)).violations).toEqual([
      'hotspot HS_driver has a world matrix that is not a finite 4x4 matrix, so its rest position cannot be read',
    ])
  })

  it('reports an HS_ node hanging in the scene root', () => {
    const manifest = manifestWith({ hotspots: [driverHotspot] })
    const structure = readProductStructure(
      buildFixtureDocument({ hotspotNames: ['HS_driver'], hotspotParent: { kind: 'scene' } }),
    )
    const result = checkHotspots(manifest, structure)
    expect(result.violations).toEqual([
      'hotspot HS_driver is parented to scene root, expected a PART_ node',
    ])
  })

  it('reports a manifest finish with no variant and an extra variant', () => {
    const manifest = manifestWith({
      finishes: [
        { variant: 'velvet', label: 'Velvet', swatch: '#401050' },
        { variant: 'sage', label: 'Sage Green', swatch: '#9DB89D' },
      ],
    })
    const structure = readProductStructure(buildFixtureDocument({ variantNames: ['sage', 'neon'] }))
    const result = checkFinishes(manifest, structure)
    expect(result.violations).toEqual([
      `manifest finish has no matching variant: 'velvet'`,
      `variant has no manifest finish: 'neon'`,
    ])
  })

  it('names an empty variant list', () => {
    const structure = readProductStructure(buildFixtureDocument({ variantNames: [] }))
    const result = checkFinishes(fixture, structure)
    expect(result.detail).toBe('no variants')
    expect(result.violations).toEqual([
      `manifest finish has no matching variant: 'sage'`,
      `manifest finish has no matching variant: 'graphite'`,
    ])
  })

  it('reports zero animations', () => {
    const structure = readProductStructure(buildFixtureDocument({ animationNames: [] }))
    const result = checkExplode(fixture, structure)
    expect(result.violations).toEqual([`expected exactly one 'Explode' animation, found 0`])
  })

  it('reports two animations of the same clip name', () => {
    const structure = readProductStructure(
      buildFixtureDocument({ animationNames: ['Explode', 'Explode'] }),
    )
    const result = checkExplode(fixture, structure)
    expect(result.violations).toEqual([`expected exactly one 'Explode' animation, found 2`])
  })

  it('reports a wrongly named clip', () => {
    const structure = readProductStructure(buildFixtureDocument({ animationNames: ['Pop'] }))
    const result = checkExplode(fixture, structure)
    expect(result.violations).toEqual([
      `expected exactly one 'Explode' animation, found 0`,
      'unexpected animation: Pop',
    ])
  })

  it('reports the clip the manifest names, not the default', () => {
    const manifest = manifestWith({ explode: { clip: 'Open up', label: 'See inside' } })
    const structure = readProductStructure(buildFixtureDocument())
    const result = checkExplode(manifest, structure)
    expect(result.violations).toEqual([
      `expected exactly one 'Open up' animation, found 0`,
      'unexpected animation: Explode',
    ])
  })

  it('passes on the named clip when the model carries exactly that one', () => {
    const manifest = manifestWith({ explode: { clip: 'Open up', label: 'See inside' } })
    const structure = readProductStructure(buildFixtureDocument({ animationNames: ['Open up'] }))
    expect(checkExplode(manifest, structure).status).toBe('pass')
  })

  it('carries the default clip when the manifest has no explode block', () => {
    const manifest = manifestWith({ explode: undefined })
    expect(manifest.explode.clip).toBe('Explode')
    const structure = readProductStructure(buildFixtureDocument())
    expect(checkExplode(manifest, structure).status).toBe('pass')
  })

  it('reports a non-KTX2 image and missing Meshopt', () => {
    const result = checkEncoding({
      textures: [{ label: 'BC_body', mimeType: 'image/png', dimensions: [1024, 1024] }],
      meshoptCompressed: false,
    })
    expect(result.violations).toEqual([
      `texture 'BC_body' is image/png, expected image/ktx2`,
      'no EXT_meshopt_compression: the optimize step did not run',
    ])
  })

  it('reports a manifest slug that does not match the folder', () => {
    const result = checkManifest('fixture-speaker', manifestWith({ slug: 'other-speaker' }))
    expect(result.violations).toEqual([
      `manifest slug 'other-speaker' does not match the product folder 'fixture-speaker'`,
    ])
  })

  it('accepts a texture exactly on each budget edge', () => {
    const result = checkBudgets({
      fileBytes: 4 * 1024 * 1024,
      textures: [{ label: 'BC_edge', mimeType: 'image/ktx2', dimensions: [2048, 2048] }],
      drawCalls: 50,
    })
    expect(result.violations).toEqual([])
  })
})
