// The camera contract check, over contract documents built in memory: the
// names rule it inherits, the aspect rule, and the geometry and limit rules
// through the one shared assembly. Every case asserts the exact violation messages:
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

  it('reports every view outside the authored distance limits, by its view', () => {
    // The fixture cameras share one pose, so the home and the driver
    // close-up both sit at distance 4, outside the authored range.
    const manifest = manifestWith({ camera: { minDistance: 4.5, maxDistance: 9 } })
    const structure = readProductStructure(buildFixtureDocument())
    const result = checkCameras(manifest, structure, cameraContract)
    expect(result.violations).toEqual([
      'the CAM_home distance 4 lies outside the distance limits [4.5, 9]',
      'the CAM_driver distance 4 lies outside the distance limits [4.5, 9]',
    ])
  })

  it('reports a close-up below the minimum the home view sets, and passes it once authored', () => {
    // The driver close-up moves in to 1.5 in front of the model center,
    // below the fallback minimum of half the home distance.
    const doc = buildFixtureDocument()
    nodeNamed(doc, 'CAM_driver').setTranslation([1, 1, 1.5])
    const structure = readProductStructure(doc)
    expect(checkCameras(fixture, structure, cameraContract).violations).toEqual([
      'the CAM_driver distance 1.5 lies outside the distance limits [2, 10]',
    ])
    const authored = manifestWith({ camera: { minDistance: 1.5 } })
    expect(checkCameras(authored, structure, cameraContract).violations).toEqual([])
  })

  it('leaves a camera named after no hotspot out of the view rules, as the rig does', () => {
    // CAM_side is no hotspot's close-up, so the site never presents it: it
    // breaks the distance limits and still only warns as an unknown camera.
    const doc = buildFixtureDocument({ cameraNames: ['CAM_home', 'CAM_driver', 'CAM_side'] })
    nodeNamed(doc, 'CAM_side').setTranslation([1, 1, 1.5])
    const result = checkCameras(fixture, readProductStructure(doc), cameraContract)
    expect(result.violations).toEqual([])
    expect(result.warnings).toEqual([`camera CAM_side has no manifest hotspot 'side'`])
  })

  it('reports an authored minimum that does not clear the model radius', () => {
    const manifest = manifestWith({ camera: { minDistance: 1 } })
    const structure = readProductStructure(buildFixtureDocument())
    const result = checkCameras(manifest, structure, cameraContract)
    expect(result.violations).toEqual([
      'the minimum distance 1 does not exceed the model radius 1.4142135623730951',
    ])
  })

  it('reports every view outside the polar limits, by its view', () => {
    // Cameras aimed straight down from above the model: their polar angle
    // is 0, below the configured minimum, while the distances stay inside.
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
    const polarRange = `[${(15 * Math.PI) / 180}, ${(165 * Math.PI) / 180}]`
    expect(result.violations).toEqual([
      `the CAM_home polar angle 0 lies outside the polar limits ${polarRange}`,
      `the CAM_driver polar angle 0 lies outside the polar limits ${polarRange}`,
    ])
  })

  it('reports a camera whose field of view is degenerate, through the one assembly', () => {
    const structure = readProductStructure(
      buildFixtureDocument({ cameraPose: poseWith({ fovYDegrees: 0 }) }),
    )
    const result = checkCameras(fixture, structure, cameraContract)
    expect(result.violations).toEqual(
      ['CAM_home', 'CAM_driver'].map(
        (name) =>
          `the camera ${name} has a field of view of 0 rad, outside the open range (0, ${Math.PI})`,
      ),
    )
  })

  it('holds a close-up whose geometry is broken to its geometry alone, beside a sound home', () => {
    // A close-up with a zero field of view has no orbit to hold to the
    // limits, so its geometry problem is the one message, while the home
    // view still derives the limits the other views answer to.
    const doc = buildFixtureDocument()
    const camera = nodeNamed(doc, 'CAM_driver').getCamera()
    if (camera === null) {
      throw new Error('the fixture CAM_driver carries no camera')
    }
    camera.setYFov(0)
    const result = checkCameras(fixture, readProductStructure(doc), cameraContract)
    expect(result.violations).toEqual([
      `the camera CAM_driver has a field of view of 0 rad, outside the open range (0, ${Math.PI})`,
    ])
  })
})
