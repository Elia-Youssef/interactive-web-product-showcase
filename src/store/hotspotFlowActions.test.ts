import { describe, expect, it } from 'vitest'
import type { ProductRigSummary } from '@lib/product'
import { createAppStore } from './createAppStore'

// The store's composed flow actions on a real store: each event is one
// update holding the next selection and the camera request it owes, the
// close-up set and the explode target are read at the event, and the
// close-up belongs to the selection of one product.

const FORMA = 'sample-one'
const SPEAKER = 'sample-two'

// A ready product's rig summary: both products carry a 'driver' hotspot,
// only the given ones have a close-up camera.
function rigWith(closeUps: readonly string[]): ProductRigSummary {
  return {
    parts: ['PART_base'],
    hotspots: [
      { id: 'driver', part: 'PART_base' },
      { id: 'knob', part: 'PART_base' },
    ],
    cameras: ['CAM_home', ...closeUps.map((id) => `CAM_${id}`)],
    clip: { name: 'Explode', durationSeconds: 1 },
    variants: [],
  }
}

// A store with the product ready and its explode view attached, and a
// counter of the store's notifications from then on.
function presented(slug: string, closeUps: readonly string[]) {
  const store = createAppStore()
  store.getState().productReady(slug, rigWith(closeUps), {
    meshes: 1,
    triangles: 12,
    geometryBytes: 48,
    textureBytes: 0,
  })
  store.getState().explodeAttach(slug)
  const notifications = { count: 0 }
  store.subscribe(() => {
    notifications.count += 1
  })
  return { store, actions: store.getState(), notifications }
}

function cameraRequestOf(store: ReturnType<typeof createAppStore>) {
  return store.getState().cameraRequestChannel
}

describe('the composed flow actions', () => {
  it('write each event in one update, the selection with the camera request it owes', () => {
    const { store, actions, notifications } = presented(FORMA, ['driver'])

    actions.hotspotPressed(FORMA, 'driver')
    expect(notifications.count).toBe(1)
    expect(store.getState().hotspotStatus).toEqual({
      kind: 'selected',
      product: FORMA,
      hotspot: 'driver',
      closeUp: true,
    })
    expect(cameraRequestOf(store)).toEqual({
      sequence: 1,
      request: { kind: 'view', viewId: 'driver' },
    })

    actions.explodeToggle(FORMA)
    expect(notifications.count).toBe(2)
    expect(store.getState().explodeStatus).toEqual({
      kind: 'active',
      product: FORMA,
      target: 1,
    })
    expect(store.getState().hotspotStatus).toEqual({
      kind: 'selected',
      product: FORMA,
      hotspot: 'driver',
      closeUp: false,
    })
    expect(cameraRequestOf(store)).toEqual({
      sequence: 2,
      request: { kind: 'view', viewId: 'home' },
    })

    actions.stageReset()
    expect(notifications.count).toBe(3)
    expect(store.getState().hotspotStatus).toEqual({ kind: 'idle' })
    expect(cameraRequestOf(store)).toEqual({
      sequence: 3,
      request: { kind: 'view', viewId: 'home' },
    })
  })

  it('advances the camera sequence exactly as a direct request does', () => {
    const { store, actions } = presented(FORMA, ['driver'])

    actions.cameraRequest({ kind: 'zoom', steps: 1 })
    actions.hotspotPressed(FORMA, 'driver')
    actions.hotspotClosed(FORMA)

    expect(cameraRequestOf(store)).toEqual({
      sequence: 3,
      request: { kind: 'view', viewId: 'home' },
    })
  })

  it('reads the close-up set and the explode target at the press', () => {
    const { store, actions } = presented(FORMA, ['driver'])

    actions.explodeScrub(FORMA, 0.25)
    actions.hotspotPressed(FORMA, 'driver')

    expect(store.getState().hotspotStatus).toEqual({
      kind: 'selected',
      product: FORMA,
      hotspot: 'driver',
      closeUp: false,
    })
    expect(cameraRequestOf(store)).toEqual({ sequence: 0, request: null })
  })

  it('keeps the selection through every change of the explode', () => {
    const { store, actions, notifications } = presented(FORMA, ['driver'])

    actions.hotspotPressed(FORMA, 'knob')
    actions.explodeScrub(FORMA, 0.5)
    actions.explodeScrub(FORMA, 0)
    actions.explodeToggle(FORMA)

    expect(notifications.count).toBe(4)
    expect(store.getState().hotspotStatus).toEqual({
      kind: 'selected',
      product: FORMA,
      hotspot: 'knob',
      closeUp: false,
    })
    expect(cameraRequestOf(store)).toEqual({ sequence: 0, request: null })
  })

  it('moves no camera when the explode target returns to 0', () => {
    const { store, actions } = presented(FORMA, ['driver'])

    actions.explodeScrub(FORMA, 0.5)
    actions.hotspotPressed(FORMA, 'driver')
    actions.explodeScrub(FORMA, 0)

    expect(store.getState().hotspotStatus).toEqual({
      kind: 'selected',
      product: FORMA,
      hotspot: 'driver',
      closeUp: false,
    })
    expect(cameraRequestOf(store)).toEqual({ sequence: 0, request: null })
  })

  it('notifies no one for an event that changes nothing', () => {
    const { actions, notifications } = presented(FORMA, ['driver'])

    actions.hotspotClosed(FORMA)
    actions.hotspotLeft(FORMA)
    actions.explodeScrub(FORMA, 0)

    expect(notifications.count).toBe(0)
  })

  it('keeps a close-up scoped to its product across a switch to a product with the same id', () => {
    const { store, actions } = presented(FORMA, ['driver'])
    actions.hotspotPressed(FORMA, 'driver')
    const entered = cameraRequestOf(store)

    // The second product presents, its driver without a close-up, and its
    // view opens: the first product's close-up is not its own, so neither
    // owes the camera a return home.
    actions.productReady(SPEAKER, rigWith([]), {
      meshes: 1,
      triangles: 12,
      geometryBytes: 48,
      textureBytes: 0,
    })
    actions.explodeAttach(SPEAKER)
    actions.explodeToggle(SPEAKER)
    expect(cameraRequestOf(store)).toBe(entered)

    actions.hotspotPressed(SPEAKER, 'driver')
    expect(store.getState().hotspotStatus).toEqual({
      kind: 'selected',
      product: SPEAKER,
      hotspot: 'driver',
      closeUp: false,
    })
    expect(cameraRequestOf(store)).toBe(entered)
  })

  it('clears the selection of the product that leaves only, with no camera request', () => {
    const { store, actions } = presented(FORMA, ['driver'])
    actions.hotspotPressed(FORMA, 'driver')
    const entered = cameraRequestOf(store)

    actions.hotspotLeft(SPEAKER)
    expect(store.getState().hotspotStatus).toMatchObject({ kind: 'selected', product: FORMA })

    actions.hotspotLeft(FORMA)
    expect(store.getState().hotspotStatus).toEqual({ kind: 'idle' })
    expect(cameraRequestOf(store)).toBe(entered)
  })
})
