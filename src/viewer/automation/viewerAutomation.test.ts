import { describe, expect, it } from 'vitest'
import type { ProductModelCounts, ProductRigSummary } from '@lib/product'
import type { ProductStatus, RendererStatus } from '@store/index'
import { StageProbes } from './StageProbes'
import type {
  ViewerCameraAutomation,
  ViewerFinish,
  ViewerHotspotsAutomation,
  ViewerLook,
} from './viewerAutomation'
import { createViewerAutomation, type ViewerAutomationSources } from './viewerAutomation'
import {
  productFailureOf,
  productModelOf,
  productRigOf,
  productSlugOf,
  rendererFailureOf,
} from './viewerAutomation.logic'

const look: ViewerLook = {
  exposure: 1.25,
  environmentIntensity: 0.8,
  environmentRotationDeg: 45,
  shadow: null,
  textures: null,
}

const camera: ViewerCameraAutomation = {
  position: { x: 1, y: 2, z: 3 },
  target: { x: 0, y: 0, z: 0 },
  fovY: 0.7,
  azimuth: -0.6,
  polar: 1.1,
  distance: 3.7,
  minDistance: 1.85,
  maxDistance: 9.25,
}

const finish: ViewerFinish = {
  product: 'forma-one',
  applied: 'sage',
  requested: 'sage',
  materials: { 'PART_base:0': 'MatSage' },
}

const hotspots: ViewerHotspotsAutomation = {
  product: 'forma-one',
  hotspots: [
    { id: 'driver', position: { x: 0.02, y: 0.11, z: 0.2 } },
    { id: 'knob', position: { x: 0, y: 0.25, z: 0 } },
  ],
}

const rig: ProductRigSummary = {
  parts: ['PART_base'],
  hotspots: [],
  cameras: ['CAM_home'],
  clip: { name: 'Explode', durationSeconds: 2 },
  variants: [],
}

const counts: ProductModelCounts = { meshes: 4, triangles: 1200 }

const readyRenderer: RendererStatus = { kind: 'ready', backend: 'webgpu' }
const readyProduct: ProductStatus = { kind: 'ready', slug: 'forma-one', rig, model: counts }

function sourcesWith(overrides?: Partial<ViewerAutomationSources>): ViewerAutomationSources {
  const probes = new StageProbes()
  probes.register('look', () => look)
  probes.register('camera', () => camera)
  probes.register('finish', () => finish)
  probes.register('hotspots', () => hotspots)
  return {
    probes,
    getStatus: () => readyRenderer,
    getProductStatus: () => readyProduct,
    renderedFrames: () => 7,
    getToneMapping: () => 4000,
    ...overrides,
  }
}

describe('createViewerAutomation', () => {
  it('reads a registered fake through the automation object for every probe key', () => {
    const automation = createViewerAutomation(sourcesWith())

    expect(automation.look).toEqual(look)
    expect(automation.camera).toEqual(camera)
    expect(automation.finish).toEqual(finish)
    expect(automation.hotspots).toEqual(hotspots)
  })

  it('reads null for a probe key no component holds', () => {
    const automation = createViewerAutomation(sourcesWith({ probes: new StageProbes() }))

    expect(automation.look).toBeNull()
    expect(automation.camera).toBeNull()
    expect(automation.finish).toBeNull()
    expect(automation.hotspots).toBeNull()
  })

  it('reads the store and clock fields at access time', () => {
    let renderer: RendererStatus = readyRenderer
    let product: ProductStatus = readyProduct
    let frames = 1
    const automation = createViewerAutomation(
      sourcesWith({
        getStatus: () => renderer,
        getProductStatus: () => product,
        renderedFrames: () => frames,
      }),
    )

    expect(automation.status).toBe('ready')
    expect(automation.backend).toBe('webgpu')
    expect(automation.ready).toBe(true)
    expect(automation.failure).toBeNull()
    expect(automation.product).toBe('ready')
    expect(automation.productSlug).toBe('forma-one')
    expect(automation.productFailure).toBeNull()
    expect(automation.rig).toEqual(rig)
    expect(automation.model).toEqual({ slug: 'forma-one', meshes: 4, triangles: 1200 })
    expect(automation.renderedFrames).toBe(1)

    renderer = { kind: 'failed', reason: 'the canvas is gone' }
    product = {
      kind: 'failed',
      slug: 'forma-one',
      failure: { kind: 'render', message: 'the model broke' },
    }
    frames = 2
    expect(automation.status).toBe('failed')
    expect(automation.backend).toBeNull()
    expect(automation.ready).toBe(false)
    expect(automation.failure).toBe('the canvas is gone')
    expect(automation.product).toBe('failed')
    expect(automation.productFailure).toEqual({ kind: 'render', message: 'the model broke' })
    expect(automation.rig).toBeNull()
    expect(automation.model).toBeNull()
    expect(automation.renderedFrames).toBe(2)
  })
})

describe('the store field derivations', () => {
  it('the renderer failure is the failed status reason, null otherwise', () => {
    expect(rendererFailureOf({ kind: 'failed', reason: 'no adapter' })).toBe('no adapter')
    expect(rendererFailureOf(readyRenderer)).toBeNull()
    expect(rendererFailureOf({ kind: 'initializing' })).toBeNull()
  })

  it('the product slug names the product the store works on, null when idle', () => {
    expect(productSlugOf({ kind: 'loading', slug: 'forma-one' })).toBe('forma-one')
    expect(productSlugOf(readyProduct)).toBe('forma-one')
    expect(
      productSlugOf({
        kind: 'failed',
        slug: 'forma-one',
        failure: { kind: 'unexpected', message: 'x' },
      }),
    ).toBe('forma-one')
    expect(productSlugOf({ kind: 'idle' })).toBeNull()
  })

  it('the product failure is the failed status failure, null otherwise', () => {
    const failure = {
      kind: 'load',
      url: '/models/forma-one/model.glb',
      message: 'bad glb',
    } as const
    expect(productFailureOf({ kind: 'failed', slug: 'forma-one', failure })).toBe(failure)
    expect(productFailureOf(readyProduct)).toBeNull()
    expect(productFailureOf({ kind: 'idle' })).toBeNull()
  })

  it('the rig is the ready status summary, null otherwise', () => {
    expect(productRigOf(readyProduct)).toBe(rig)
    expect(productRigOf({ kind: 'loading', slug: 'forma-one' })).toBeNull()
    expect(productRigOf({ kind: 'idle' })).toBeNull()
  })

  it('the model is the presented product with its counts, null otherwise', () => {
    expect(productModelOf(readyProduct)).toEqual({
      slug: 'forma-one',
      meshes: 4,
      triangles: 1200,
    })
    expect(productModelOf({ kind: 'loading', slug: 'forma-one' })).toBeNull()
    expect(productModelOf({ kind: 'idle' })).toBeNull()
  })
})
