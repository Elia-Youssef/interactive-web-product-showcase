// Every facts reader's cached result: a second read of the same product in
// the same process returns the one cached derivation without reading or
// parsing again, the facts come back frozen with lazy getters still lazy,
// and a fresh derive matches the cached one exactly, so the cache cannot
// change what a spec sees. The warm phase runs against the module as
// imported; the cold phase resets the module registry, which is the state
// of a process that has never read the product, and derives again. Facts
// that carry live three meshes compare through a plain-data projection:
// the meshes' names, sizes and world matrices, which is everything the
// raycasts read.
//
// The inputs are the fixture products, the product-shaped models the
// behavior specs run on: re deriving a shipped product's hiding height
// searches on every gate run is the cost this test exists to avoid (one
// shipped derive costs seconds to minutes, a fixture's stays under two
// seconds), and the equality of every reader's facts for all six products
// was proven once against the shipped set at hand back. Each reader runs
// on every fixture that carries what it reads, and asserts those facts on
// the derived result, so a fixture that loses them fails here by name
// instead of passing vacuously.
import { fileURLToPath } from 'node:url'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { NodeIO } from '@gltf-transform/core'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import type { Mesh } from 'three'
import { listFixtureProductSlugs } from '../../scripts/fixtureProducts.ts'
import { loadTestCollection } from './productList'
import { readMarkerExtentTokens } from './markerExtentTokens'
import type { AuthoredView, ProductCameraFacts } from './productCamera'
import type { ProductHotspotFacts } from './productHotspots'
import type { ProductModelFacts } from './productModel'
import type { ExplodeModelFacts } from './explodeModelFacts'
import type { ScrubMarkerFacts } from './scrubMarkerFacts'

const ROOT = fileURLToPath(new URL('../..', import.meta.url))

const FIXTURE_SLUGS = await listFixtureProductSlugs(ROOT)

const PRODUCTS = (await loadTestCollection()).products
const EXTENT = await readMarkerExtentTokens()

const WIDE_BOX = { width: 1280, height: 720 }
const NARROW_BOX = { width: 320, height: 256 }

function productOf(slug: string) {
  const product = PRODUCTS.find((candidate) => candidate.slug === slug)
  if (product === undefined) {
    throw new Error(`no product in the test collection for ${slug}`)
  }
  return product
}

// The fixtures whose manifest carries hotspots: the inputs the hotspot and
// scrub facts read. No fixture carrying hotspots at all is a gate failure
// by name, never a vacuous pass.
const HOTSPOT_SLUGS = FIXTURE_SLUGS.filter((slug) => productOf(slug).hotspots.length > 0)
if (HOTSPOT_SLUGS.length === 0) {
  throw new Error(
    'no fixture product carries hotspots, so the hotspot and scrub reads have no input',
  )
}

function viewJsonOf(view: AuthoredView) {
  return {
    position: [...view.position],
    target: [...view.target],
    fovY: view.fovY,
    aspect: view.aspect,
    near: view.near,
    far: view.far,
    azimuthDegrees: view.azimuthDegrees,
    polarDegrees: view.polarDegrees,
    distance: view.distance,
  }
}

function pointJsonOf(point: readonly number[]) {
  return [...point]
}

function cameraJsonOf(facts: ProductCameraFacts) {
  return {
    center: pointJsonOf(facts.center),
    stageBounds: {
      min: pointJsonOf(facts.stageBounds.min),
      max: pointJsonOf(facts.stageBounds.max),
    },
    home: viewJsonOf(facts.home),
    closeUps: [...facts.closeUps].map(([id, view]) => [id, viewJsonOf(view)]),
  }
}

function occluderJsonOf(mesh: Mesh) {
  return {
    name: mesh.name,
    positionCount: mesh.geometry.getAttribute('position')?.count ?? null,
    indexCount: mesh.geometry.index?.count ?? null,
    matrixWorld: Array.from(mesh.matrixWorld.elements),
  }
}

function hotspotJsonOf(facts: ProductHotspotFacts) {
  return {
    hotspots: facts.hotspots.map((hotspot) => ({
      id: hotspot.id,
      stagePosition: pointJsonOf(hotspot.stagePosition),
      hidingHeightM: hotspot.hidingHeightM,
    })),
    occluderBounds: {
      min: pointJsonOf(facts.occluderBounds.min),
      max: pointJsonOf(facts.occluderBounds.max),
    },
    occluders: facts.occluders.map(occluderJsonOf),
  }
}

function modelJsonOf(facts: ProductModelFacts) {
  return {
    partNames: [...facts.partNames],
    cameraNames: [...facts.cameraNames],
    hotspotParts: [...facts.hotspotParts],
    clipName: facts.clipName,
    clipDurationSeconds: facts.clipDurationSeconds,
  }
}

function explodeJsonOf(facts: ExplodeModelFacts) {
  return {
    clipName: facts.clipName,
    clipDurationSeconds: facts.clipDurationSeconds,
    firstPose: { ...facts.firstPose },
    lastPose: { ...facts.lastPose },
  }
}

function scrubJsonOf(facts: ScrubMarkerFacts) {
  return [...facts].map(([id, shown]) => [id, [...shown]])
}

afterEach(() => {
  vi.restoreAllMocks()
})

describe.each(FIXTURE_SLUGS)('the camera facts of %s', (slug) => {
  it('reads once, freezes, and matches a fresh derive', async () => {
    vi.resetModules()
    const { readProductCameraFacts } = await import('./productCamera')
    const reads = vi.spyOn(NodeIO.prototype, 'read')
    const warm = await readProductCameraFacts(slug)
    const warmAgain = await readProductCameraFacts(slug)
    expect(reads).toHaveBeenCalledTimes(1)
    expect(warmAgain).toBe(warm)
    // The derive itself fails by name on a model without its CAM_ cameras,
    // which is the coverage this reader needs.
    expect(Object.isFrozen(warm)).toBe(true)
    expect(Object.isFrozen(warm.home)).toBe(true)
    expect(Object.isFrozen(warm.home.position)).toBe(true)
    expect([...warm.closeUps.values()].every((view) => Object.isFrozen(view))).toBe(true)

    vi.resetModules()
    const { readProductCameraFacts: readCold } = await import('./productCamera')
    const cold = await readCold(slug)
    expect(cameraJsonOf(cold)).toEqual(cameraJsonOf(warm))
  })
})

describe.each(HOTSPOT_SLUGS)('the hotspot facts of %s', (slug) => {
  it('reads and parses once, freezes, and matches a fresh derive', async () => {
    vi.resetModules()
    const { readProductHotspotFacts } = await import('./productHotspots')
    const reads = vi.spyOn(NodeIO.prototype, 'read')
    const parses = vi.spyOn(GLTFLoader.prototype, 'parseAsync')
    const warm = await readProductHotspotFacts(slug, productOf(slug))
    expect(warm.hotspots.length).toBeGreaterThan(0)
    const warmAgain = await readProductHotspotFacts(slug, productOf(slug))
    expect(reads).toHaveBeenCalledTimes(1)
    expect(parses).toHaveBeenCalledTimes(1)
    expect(warmAgain).toBe(warm)
    expect(Object.isFrozen(warm)).toBe(true)
    expect(Object.isFrozen(warm.hotspots)).toBe(true)
    expect(Object.isFrozen(warm.occluderBounds)).toBe(true)
    expect(Object.isFrozen(warm.occluders)).toBe(true)

    vi.resetModules()
    const { readProductHotspotFacts: readCold } = await import('./productHotspots')
    const cold = await readCold(slug, productOf(slug))
    expect(hotspotJsonOf(cold)).toEqual(hotspotJsonOf(warm))
  })
})

describe.each(FIXTURE_SLUGS)('the model facts of %s', (slug) => {
  it('reads once, freezes, and matches a fresh derive', async () => {
    vi.resetModules()
    const { readProductModelFacts } = await import('./productModel')
    const reads = vi.spyOn(NodeIO.prototype, 'read')
    const warm = await readProductModelFacts(slug)
    expect(warm.partNames.length).toBeGreaterThan(0)
    expect(warm.hotspotParts.size).toBeGreaterThan(0)
    const warmAgain = await readProductModelFacts(slug)
    expect(reads).toHaveBeenCalledTimes(1)
    expect(warmAgain).toBe(warm)
    expect(Object.isFrozen(warm)).toBe(true)
    expect(Object.isFrozen(warm.partNames)).toBe(true)

    vi.resetModules()
    const { readProductModelFacts: readCold } = await import('./productModel')
    const cold = await readCold(slug)
    expect(modelJsonOf(cold)).toEqual(modelJsonOf(warm))
  })
})

describe.each(FIXTURE_SLUGS)('the explode facts of %s', (slug) => {
  it('reads once, freezes, and matches a fresh derive', async () => {
    vi.resetModules()
    const { readExplodeModelFacts } = await import('./explodeModelFacts')
    const reads = vi.spyOn(NodeIO.prototype, 'read')
    const warm = await readExplodeModelFacts(slug)
    expect(Object.keys(warm.firstPose).length).toBeGreaterThan(0)
    const warmAgain = await readExplodeModelFacts(slug)
    expect(reads).toHaveBeenCalledTimes(1)
    expect(warmAgain).toBe(warm)
    expect(Object.isFrozen(warm)).toBe(true)
    expect(Object.isFrozen(warm.firstPose)).toBe(true)

    vi.resetModules()
    const { readExplodeModelFacts: readCold } = await import('./explodeModelFacts')
    const cold = await readCold(slug)
    expect(explodeJsonOf(cold)).toEqual(explodeJsonOf(warm))
  })
})

describe.each(FIXTURE_SLUGS)('the shadow opacity of %s', (slug) => {
  it('reads once and matches a fresh derive', async () => {
    vi.resetModules()
    const { readShadowAuthoredOpacity } = await import('./shadowModelFacts')
    const reads = vi.spyOn(NodeIO.prototype, 'read')
    const warm = await readShadowAuthoredOpacity(slug)
    expect(Number.isFinite(warm)).toBe(true)
    const warmAgain = await readShadowAuthoredOpacity(slug)
    expect(reads).toHaveBeenCalledTimes(1)
    expect(warmAgain).toBe(warm)

    vi.resetModules()
    const { readShadowAuthoredOpacity: readCold } = await import('./shadowModelFacts')
    expect(await readCold(slug)).toBe(warm)
  })
})

describe.each(HOTSPOT_SLUGS)('the scrub marker facts of %s', (slug) => {
  it('parses once, freezes, keys by the stage read, and matches a fresh derive', async () => {
    vi.resetModules()
    const { readScrubMarkerFacts } = await import('./scrubMarkerFacts')
    const { readProductCameraFacts } = await import('./productCamera')
    const reads = vi.spyOn(NodeIO.prototype, 'read')
    const parses = vi.spyOn(GLTFLoader.prototype, 'parseAsync')
    const product = productOf(slug)
    const views = await readProductCameraFacts(slug)
    const stage = { box: WIDE_BOX, extent: EXTENT }
    const warm = await readScrubMarkerFacts(product, views.center, views.home, stage)
    expect(warm.size).toBe(product.hotspots.length)
    const warmAgain = await readScrubMarkerFacts(product, views.center, views.home, stage)
    expect(reads).toHaveBeenCalledTimes(1)
    expect(parses).toHaveBeenCalledTimes(1)
    expect(warmAgain).toBe(warm)
    // A Map cannot be frozen; its shown sets are, and its ReadonlyMap type
    // is what keeps the map itself out of a caller's hands.
    for (const shown of warm.values()) {
      expect(Object.isFrozen(shown)).toBe(true)
    }

    // Another stage is another read: its facts derive separately from the
    // same one parse, so a second box never sees the first box's answer.
    const narrow = await readScrubMarkerFacts(product, views.center, views.home, {
      box: NARROW_BOX,
      extent: EXTENT,
    })
    expect(parses).toHaveBeenCalledTimes(1)
    expect(narrow).not.toBe(warm)

    vi.resetModules()
    const { readScrubMarkerFacts: readCold } = await import('./scrubMarkerFacts')
    const { readProductCameraFacts: readColdViews } = await import('./productCamera')
    const coldViews = await readColdViews(slug)
    const cold = await readCold(product, coldViews.center, coldViews.home, stage)
    expect(scrubJsonOf(cold)).toEqual(scrubJsonOf(warm))
  })
})
