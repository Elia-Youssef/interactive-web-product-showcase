// The camera contract check, over contract documents built in memory: the
// names rule it inherits, the aspect rule, and the limit rules through the
// one shared assembly. Every case asserts the exact violation messages:
// the report's wording is part of the contract.
import { describe, expect, it } from 'vitest'
import { parseProduct } from '../src/lib/product/index.ts'
import type { Product, ProductInput } from '../src/lib/product/index.ts'
import { authoredCameraAspect } from '../src/lib/camera/config.ts'
import { readProductStructure } from './structure.ts'
import {
  buildDocument,
  cameraContract,
  nodeNamed,
  PASSING_CAMERA_POSE,
  type CameraPose,
  type DocumentOptions,
} from './validateFixtures.ts'
import { checkCameras } from './validateCameras.ts'

function buildFixtureDocument(options: DocumentOptions = {}) {
  return buildDocument({ hotspotNames: ['HS_driver', 'HS_knob'], ...options })
}

// A camera pose that bends one fact of the passing pose.
function poseWith(overrides: Partial<CameraPose>): CameraPose {
  return { ...PASSING_CAMERA_POSE, ...overrides }
}

// The manifest every case reads, parsed through the real schema, with the
// camera block each case overrides.
const fixtureInput = {
  slug: 'fixture-speaker',
  number: 2,
  category: 'Audio',
  brand: 'Sample',
  model: 'Speaker',
  eyebrow: 'Compact speaker / 002',
  tagline: 'A quiet box that fills the room.',
  intro: ['One line.'],
  finishes: [
    { variant: 'sage', label: 'Sage Green', swatch: '#9DB89D' },
    { variant: 'graphite', label: 'Graphite', swatch: '#2B2E2C' },
  ],
  hotspots: [
    {
      id: 'driver',
      eyebrow: 'A closer look',
      title: 'Full-range driver',
      bullets: ['Behind the grille'],
    },
    {
      id: 'knob',
      eyebrow: 'On top',
      title: 'Volume knob',
      bullets: ['Machined aluminum'],
    },
  ],
  explode: { clip: 'Explode', label: 'See inside' },
} satisfies ProductInput

function manifestWith(overrides: Partial<ProductInput>): Product {
  return parseProduct({ ...fixtureInput, ...overrides }, 'fixture')
}

const fixture = parseProduct(fixtureInput, 'fixture')

describe('the camera contract check', () => {
  it('passes on the valid document', () => {
    const result = checkCameras(
      fixture,
      readProductStructure(buildFixtureDocument()),
      cameraContract,
    )
    expect(result.status).toBe('pass')
    expect(result.violations).toEqual([])
    expect(result.warnings).toEqual([])
  })

  it('reports a missing CAM_home', () => {
    const structure = readProductStructure(buildFixtureDocument({ cameraNames: ['CAM_driver'] }))
    const result = checkCameras(fixture, structure, cameraContract)
    expect(result.violations).toEqual(['no CAM_home node, the start and reset view is required'])
  })

  it('warns, but does not fail, on a camera that is no manifest hotspot', () => {
    const structure = readProductStructure(
      buildFixtureDocument({ cameraNames: ['CAM_home', 'CAM_side'] }),
    )
    const result = checkCameras(fixture, structure, cameraContract)
    expect(result.violations).toEqual([])
    expect(result.warnings).toEqual([`camera CAM_side has no manifest hotspot 'side'`])
  })

  it('reports a camera at any other aspect ratio than the authored one', () => {
    const structure = readProductStructure(
      buildFixtureDocument({ cameraPose: poseWith({ aspect: 16 / 9 }) }),
    )
    const result = checkCameras(fixture, structure, cameraContract)
    expect(result.violations).toEqual([
      `camera CAM_home carries aspect ratio ${16 / 9}, expected the authored 1600 / 1422`,
      `camera CAM_driver carries aspect ratio ${16 / 9}, expected the authored 1600 / 1422`,
    ])
  })

  it('reports a camera with no aspect ratio', () => {
    const structure = readProductStructure(
      buildFixtureDocument({ cameraPose: poseWith({ aspect: null }) }),
    )
    const result = checkCameras(fixture, structure, cameraContract)
    expect(result.violations).toEqual([
      'camera CAM_home carries no aspect ratio, expected the authored 1600 / 1422',
      'camera CAM_driver carries no aspect ratio, expected the authored 1600 / 1422',
    ])
  })

  it('reports a camera that is not perspective', () => {
    const doc = buildFixtureDocument()
    nodeNamed(doc, 'CAM_driver').setCamera(doc.createCamera('driver-ortho').setType('orthographic'))
    const result = checkCameras(fixture, readProductStructure(doc), cameraContract)
    expect(result.violations).toEqual([
      'camera CAM_driver is not a perspective camera, the site presents perspective views only',
    ])
  })

  it('reports a home outside the authored distance limits', () => {
    const manifest = manifestWith({ camera: { minDistance: 4.5, maxDistance: 9 } })
    const structure = readProductStructure(buildFixtureDocument())
    const result = checkCameras(manifest, structure, cameraContract)
    expect(result.violations).toEqual([
      'camera CAM_home: the home distance 4 lies outside the distance limits [4.5, 9]',
    ])
  })

  it('reports an authored minimum that does not clear the model radius', () => {
    const manifest = manifestWith({ camera: { minDistance: 1 } })
    const structure = readProductStructure(buildFixtureDocument())
    const result = checkCameras(manifest, structure, cameraContract)
    expect(result.violations).toEqual([
      'camera CAM_home: the minimum distance 1 does not exceed the model radius 1.4142135623730951',
    ])
  })

  it('reports a home outside the polar limits', () => {
    // A camera aimed straight down from above the model: its polar angle is
    // 0, below the configured minimum, while the distances stay inside.
    const structure = readProductStructure(
      buildFixtureDocument({
        cameraPose: {
          position: [1, 8, 1],
          rotation: [-Math.SQRT1_2, 0, 0, Math.SQRT1_2],
          fovYDegrees: 30,
          aspect: authoredCameraAspect,
        },
      }),
    )
    const result = checkCameras(fixture, structure, cameraContract)
    expect(result.violations).toEqual([
      'camera CAM_home: the home polar angle 0 lies outside the polar limits ' +
        `[${(15 * Math.PI) / 180}, ${(165 * Math.PI) / 180}]`,
    ])
  })
})
