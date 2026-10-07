// The camera contract check at the explode's last key: the negative
// control of the reach rule over the parts' exploded bounds (a planted
// clip that leaves home's reach fails by the exact message; restored, the
// check passes), and the shadow's exclusion from those bounds (a shadow
// the rule would count breaks the same rule, shown through the assembly
// the check runs).
import { describe, expect, it } from 'vitest'
import { parseProduct } from '../src/lib/product/index.ts'
import type { ProductInput } from '../src/lib/product/index.ts'
import { cameraLimitConfig } from '../src/lib/camera/config.ts'
import {
  boundsInStageSpace,
  farthestPointFrom,
  frameSpanOfMeshBoxes,
} from '../src/lib/camera/frame.ts'
import { readProductStructure } from './structure.ts'
import { buildDocument, cameraContract, vec3Accessor } from './validateFixtures.ts'
import { checkCameras, contractViews } from './validateCameras.ts'

function buildFixtureDocument() {
  return buildDocument({ hotspotNames: ['HS_driver', 'HS_knob'] })
}

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

const fixture = parseProduct(fixtureInput, 'fixture')

// The fixture clip's one channel output accessor, to plant a pose with.
function clipOutputOf(doc: ReturnType<typeof buildDocument>) {
  const animation = doc.getRoot().listAnimations()[0]
  const sampler = animation?.listChannels()[0]?.getSampler()
  const output = sampler?.getOutput()
  if (animation === undefined || sampler === undefined || output == null) {
    throw new Error('the fixture holds the explode clip with one channel')
  }
  return output
}

describe("the camera contract check at the explode's last key", () => {
  it("fails a model whose exploded pose leaves home's reach, and passes it restored", () => {
    // The negative control of the reach rule at the explode's last key:
    // the fixture clip lifts PART_base one unit, which the home view's
    // fallback minimum clears; planted to lift it five units out along x,
    // the exploded model reaches past that minimum and only the home view
    // fails, naming the clip's end. Restored, the check passes again.
    const doc = buildFixtureDocument()
    clipOutputOf(doc).setArray(new Float32Array([0, 0, 0, 5, 0, 0]))
    const structure = readProductStructure(doc)
    expect(checkCameras(fixture, structure, cameraContract).violations).toEqual([
      `the fixture-speaker CAM_home minimum distance 2 does not exceed the model reach ${Math.sqrt(26)} at the explode's last key from its orbit target, projected from the model center`,
    ])

    clipOutputOf(doc).setArray(new Float32Array([0, 0, 0, 0, 1, 0]))
    expect(checkCameras(fixture, readProductStructure(doc), cameraContract).violations).toEqual([])
  })

  it('excludes the shadow from the exploded bounds, which would fail home if counted', () => {
    // A shadow plane wider than the product stays inside the minimum at
    // rest (where the rest reach counts it), and the parts alone stay
    // inside it at the clip's end; the same exploded bounds with the
    // shadow's box counted break the rule, so the case fails if the shadow is not excluded. The
    // counted failure is shown through the same assembly the check runs.
    const doc = buildFixtureDocument()
    clipOutputOf(doc).setArray(new Float32Array([0, 0, 0, 0, 0, 1.2]))
    // Stage space moves the model by its frame center (1, 1, 0), so the
    // plane below spans stage x [-1.4, 1.4], y [-0.05, 0.05].
    const plane = doc.createMesh('shadow')
    plane.addPrimitive(
      doc
        .createPrimitive()
        .setAttribute(
          'POSITION',
          vec3Accessor(doc, [-0.4, 0.95, 0, 2.4, 0.95, 0, -0.4, 1.05, 0, 2.4, 1.05, 0]),
        ),
    )
    doc.getRoot().listScenes()[0]?.addChild(doc.createNode('SHADOW').setMesh(plane))
    const structure = readProductStructure(doc)
    expect(checkCameras(fixture, structure, cameraContract).violations).toEqual([])

    const frame = frameSpanOfMeshBoxes([...structure.meshBoxes])
    const parts = structure.explodedBounds
    if (parts === null) {
      throw new Error('the fixture parts carry geometry')
    }
    const stageParts = boundsInStageSpace(parts, frame.center)
    const homeTarget: readonly [number, number, number] = [0, 0, 0]
    expect(farthestPointFrom(stageParts, homeTarget)).toBeLessThan(2)
    const counted = {
      min: [
        Math.min(stageParts.min[0], -1.4),
        Math.min(stageParts.min[1], -0.05),
        Math.min(stageParts.min[2], 0),
      ] as const,
      max: [
        Math.max(stageParts.max[0], 1.4),
        Math.max(stageParts.max[1], 0.05),
        Math.max(stageParts.max[2], 0),
      ] as const,
    }
    expect(farthestPointFrom(counted, homeTarget)).toBeGreaterThanOrEqual(2)
    const { views } = contractViews(fixture, structure, frame, cameraContract)
    const countedCheck = cameraContract.cameraContractProblems({
      product: fixture.slug,
      views,
      homeId: 'home',
      bounds: boundsInStageSpace(frame, frame.center),
      explodedBounds: counted,
      authoredDistanceLimits: fixture.camera ?? {},
      limits: cameraLimitConfig,
    })
    const problems = countedCheck.kind === 'broken' ? countedCheck.problems : []
    expect(problems).toEqual([
      {
        rule: 'minimum-clears-exploded-reach',
        message: expect.stringMatching(
          /^the fixture-speaker CAM_home minimum distance 2 does not exceed the model reach 2\.0976\d+ at the explode's last key from its orbit target, projected from the model center$/,
        ),
      },
    ])
  })
})
