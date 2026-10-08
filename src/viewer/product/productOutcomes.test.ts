import { describe, expect, it } from 'vitest'
import { AnimationClip, Object3D, PerspectiveCamera } from 'three/webgpu'
import { parseProduct } from '@lib/product'
import { sampleOneManifest } from '@lib/product/fixtures'
import type { ModelFrame } from '../modelFrame'
import { explodeClip, named, sourceOf, validTree } from '../rig/fixtures'
import type { ProductRig } from '../rig/productRig'
import { plannedFinish } from '@lib/product/finishPlan.fixtures'
import type { FinishResolution } from './finishMaterials'
import type { LoadedModel, ProductModelLoad } from './productModelLoads'
import { openProduct, planPresentation } from './productOutcomes'

const manifest = parseProduct(sampleOneManifest, 'sample-one.test')

// A loaded model over a rig fixture tree: the parser carries the fixture's
// glTF JSON, which is all the rig parse reads of it.
// The finish outcome a resolved load carries: an empty plan, nothing to
// derive, which is all the opening reads of it.
const resolvedFinish: FinishResolution = {
  kind: 'resolved',
  finishes: {
    plan: plannedFinish({}),
    materials: new Map(),
    rawMaterials: new Map(),
    sceneMaterials: new Set(),
  },
}

function loadedModel(
  tree: Object3D,
  finish: FinishResolution = resolvedFinish,
  animations = [explodeClip(0.5)],
): LoadedModel {
  const source = sourceOf(tree, animations)
  return {
    scene: source.scene,
    animations: source.animations,
    parser: {
      json: source.json,
      associations: new Map(),
      getDependency: () => Promise.resolve(null),
    },
    userData: { finishMaterials: finish },
  }
}

function loaded(model: LoadedModel): ProductModelLoad {
  return { kind: 'loaded', model }
}

describe('openProduct', () => {
  it('hands a failed load on as the load failure itself', () => {
    const failure = { kind: 'load', url: '/models/sample-one/model.glb', message: 'gone' } as const

    expect(openProduct({ kind: 'failed', failure }, manifest)).toEqual({
      kind: 'failed',
      failure,
    })
  })

  it('turns a model that breaks the contract into the model contract failure', () => {
    // No CAM_home and no SHADOW: two contract problems, both reported.
    const tree = new Object3D().add(named('PART_base'))
    const opened = openProduct(loaded(loadedModel(tree)), manifest)

    if (opened.kind !== 'failed') {
      throw new Error('a contract-breaking model must fail to open')
    }
    expect(opened.failure.kind).toBe('model-contract')
    expect(opened.failure).toMatchObject({
      problems: expect.arrayContaining([
        expect.objectContaining({ node: 'CAM_home' }),
        expect.objectContaining({ node: 'SHADOW' }),
      ]),
    })
  })

  it('turns a model whose finish mappings broke into the finish contract failure', () => {
    const problems = [
      { mesh: 0, primitive: 0, message: 'the mapping at 0 names variant 9, the file declares 2' },
    ]
    const opened = openProduct(
      loaded(loadedModel(validTree(), { kind: 'broken', problems })),
      manifest,
    )

    expect(opened).toEqual({ kind: 'failed', failure: { kind: 'finish-contract', problems } })
  })

  it('opens a model that holds the contract with its parsed rig', () => {
    const model = loadedModel(validTree())
    const opened = openProduct(loaded(model), manifest)

    if (opened.kind !== 'opened') {
      throw new Error(`a valid model must open, it failed with ${JSON.stringify(opened.failure)}`)
    }
    expect(opened.model).toBe(model)
    expect([...opened.rig.cameras.keys()]).toEqual(['home', 'driver'])
    expect(opened.finishes).toBe(resolvedFinish.finishes)
  })
})

// A rig whose only camera is a home view 1.2 in front of the centered
// model, the shape the camera rules read.
function homeOnlyRig(): ProductRig {
  const home = new PerspectiveCamera(30, 1.6, 0.05, 25)
  home.name = 'CAM_home'
  home.position.set(0, 0, 1.2)
  return {
    parts: new Map(),
    hotspots: [],
    cameras: new Map([['home', home]]),
    shadow: new Object3D(),
    clip: new AnimationClip('Explode', 1, []),
    variants: [],
    anchorRest: new Map(),
    explodedBounds: null,
  }
}

const centeredFrame: ModelFrame = {
  centerX: 0,
  centerY: 0,
  centerZ: 0,
  radius: 0.05,
  meshes: 1,
  triangles: 12,
  min: [-0.05, -0.05, -0.05],
  max: [0.05, 0.05, 0.05],
}

describe('planPresentation', () => {
  it('plans the presentation of cameras that hold the rules', () => {
    const presentation = planPresentation(homeOnlyRig(), manifest, centeredFrame)

    expect(presentation.kind).toBe('planned')
  })

  it('turns a camera block the home view cannot meet into the camera contract failure', () => {
    // A minimum far past the home distance: the home view lies outside the
    // authored limits, which the camera rules report.
    const impossible = parseProduct(
      { ...sampleOneManifest, camera: { minDistance: 1000 } },
      'sample-one.test',
    )
    const presentation = planPresentation(homeOnlyRig(), impossible, centeredFrame)

    if (presentation.kind !== 'failed') {
      throw new Error('an impossible camera block must fail the presentation plan')
    }
    expect(presentation.failure).toMatchObject({
      kind: 'camera-contract',
      problems: expect.arrayContaining([
        expect.objectContaining({ rule: 'view-within-distance-limits' }),
      ]),
    })
  })
})
