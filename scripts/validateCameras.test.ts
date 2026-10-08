// The camera contract check, over contract documents built in memory: the
// names rule it inherits, the aspect rule, and the geometry and limit rules
// through the one shared assembly. Every case asserts the exact violation messages:
// the report's wording is part of the contract.
import { describe, expect, it } from 'vitest'
import { fileURLToPath } from 'node:url'
import { parseProduct } from '../src/lib/product/index.ts'
import type { Product, ProductInput } from '../src/lib/product/index.ts'
import { authoredCameraAspect } from '../src/lib/camera/config.ts'
import { readProductStructure } from './structure.ts'
import {
  buildDocument,
  cameraContract,
  hangUnreadable,
  nodeNamed,
  PASSING_CAMERA_POSE,
  type CameraPose,
  type DocumentOptions,
} from './validateFixtures.ts'
import { checkCameras } from './validateCameras.ts'

// The repo root: the parent of the scripts folder this file lives in.
const ROOT = fileURLToPath(new URL('..', import.meta.url))

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

  it('reports an authored minimum that does not exceed the model reach from every view', () => {
    // Both fixture views look down -Z from (1, 1, 4) at the target (1, 1, 0),
    // where the model's farthest corner is sqrt(2) away: a minimum at or
    // under that reach fails on every view, one above it passes. The
    // fixture clip lifts PART_base by one unit in y, which keeps the
    // farthest corner at sqrt(2) from the target at the explode's last
    // key too, so home fails that end of the reach as well.
    const structure = readProductStructure(buildFixtureDocument())
    const reachProblems = (minDistance: number) => [
      `the fixture-speaker CAM_home minimum distance ${minDistance} does not exceed the model reach ${Math.SQRT2} from its orbit target, projected from the model center`,
      `the fixture-speaker CAM_driver minimum distance ${minDistance} does not exceed the model reach ${Math.SQRT2} from its orbit target, projected from the HS_driver anchor`,
      `the fixture-speaker CAM_home minimum distance ${minDistance} does not exceed the model reach ${Math.SQRT2} at the explode's last key from its orbit target, projected from the model center`,
    ]
    for (const minDistance of [1, Math.SQRT2]) {
      const manifest = manifestWith({ camera: { minDistance } })
      expect(checkCameras(manifest, structure, cameraContract).violations).toEqual(
        reachProblems(minDistance),
      )
    }
    const clear = manifestWith({ camera: { minDistance: 1.5 } })
    expect(checkCameras(clear, structure, cameraContract).violations).toEqual([])
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

  it('holds a close-up to the reach from its own anchor, which the home view does not see', () => {
    // The driver close-up looks down -Z from (2, 2, 3) at its anchor at
    // (2, 2, 0), off the model's corner: 3 away, where the model reaches
    // sqrt(8). The fallback minimum of 2 the home view sets clears the
    // home's own reach but not the close-up's; an authored 2.9 clears both.
    const doc = buildFixtureDocument()
    nodeNamed(doc, 'HS_driver').setTranslation([2, 2, 0])
    nodeNamed(doc, 'CAM_driver').setTranslation([2, 2, 3])
    const structure = readProductStructure(doc)

    expect(checkCameras(fixture, structure, cameraContract).violations).toEqual([
      `the fixture-speaker CAM_driver minimum distance 2 does not exceed the model reach ${Math.sqrt(8)} from its orbit target, projected from the HS_driver anchor`,
    ])
    const cleared = manifestWith({ camera: { minDistance: 2.9 } })
    expect(checkCameras(cleared, structure, cameraContract).violations).toEqual([])
  })

  it('reports a close-up whose anchor is missing as a problem, never orbiting the model center', () => {
    const doc = buildDocument({ hotspotNames: ['HS_knob'] })
    expect(checkCameras(fixture, readProductStructure(doc), cameraContract).violations).toEqual([
      'the camera CAM_driver has no HS_driver anchor at rest to orbit',
    ])
  })

  it('reports a close-up whose anchor has no readable rest position', () => {
    // The anchor's world matrix overflows to infinity under an unnamed
    // wrapper, so its rest cannot be read: the hotspot check names the
    // matrix and the close-up has no anchor to orbit.
    const doc = buildFixtureDocument()
    hangUnreadable(doc, 'HS_driver')
    expect(checkCameras(fixture, readProductStructure(doc), cameraContract).violations).toEqual([
      'the camera CAM_driver has no HS_driver anchor at rest to orbit',
    ])
  })

  it('holds the placeholder speaker between its close-up reach and its close-up distance', async () => {
    // Under the anchor pivot the speaker's driver close-up orbits its
    // target 0.2957 away, where the model reaches 0.2846: the authored
    // minimum must exceed the one and stay under the other, through the
    // real assembly over the fixture model, the one real model with an
    // authored camera minimum.
    const { createModelIO } = await import('./modelIo.ts')
    const { modelPathOf } = await import('./fixtureProducts.ts')
    const { manifest: speakerManifest } =
      await import('../tests/fixtures/products/placeholder-speaker/placeholder-speaker.fixtures.ts')
    const io = await createModelIO()
    const doc = await io.read(await modelPathOf(ROOT, 'placeholder-speaker'))
    const structure = readProductStructure(doc)
    const withMinimum = (minDistance: number) =>
      checkCameras(
        parseProduct({ ...speakerManifest, camera: { minDistance } }, 'placeholder-speaker'),
        structure,
        cameraContract,
      ).violations

    expect(withMinimum(0.28)).toEqual([
      expect.stringMatching(
        /^the placeholder-speaker CAM_driver minimum distance 0\.28 does not exceed the model reach 0\.2846\d* from its orbit target, projected from the HS_driver anchor$/,
      ),
    ])
    expect(withMinimum(0.3)).toEqual([
      expect.stringMatching(
        /^the CAM_driver distance 0\.2957\d* lies outside the distance limits \[0\.3, /,
      ),
    ])
    expect(
      checkCameras(parseProduct(speakerManifest, 'placeholder-speaker'), structure, cameraContract)
        .violations,
    ).toEqual([])
  })
})
