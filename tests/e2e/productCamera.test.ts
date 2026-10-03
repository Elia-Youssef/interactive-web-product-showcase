// The authored camera facts the e2e specs derive their expectations from,
// over in-memory contract documents: the frame center, the home view and
// every close-up view from the shared document facts, and the loud failure
// on a camera with no aspect ratio, the silent default the build-time
// validate step rejects.
import { describe, expect, it } from 'vitest'
import { productCameraFactsOf } from './productCamera'
import {
  buildDocument,
  nodeNamed,
  PASSING_CAMERA_POSE,
  type DocumentOptions,
} from '../../scripts/validateFixtures.ts'

function documentWith(options: DocumentOptions = {}) {
  return buildDocument({
    hotspotNames: ['HS_driver'],
    ...options,
  })
}

const MODEL_PATH = 'fixture/model.glb'

describe('productCameraFactsOf', () => {
  it('reads the frame center and the home view of a passing document', () => {
    const facts = productCameraFactsOf(documentWith(), MODEL_PATH)
    // The fixture model's box spans (0,0,0) to (2,2,0), so the center sits
    // over its middle.
    expect(facts.center).toEqual([1, 1, 0])
    expect(facts.home.aspect).toBe(PASSING_CAMERA_POSE.aspect)
    // The home camera sits 4 units in front of the center, looking at it:
    // the orbit target is the center, the distance 4, the polar angle 90
    // degrees.
    expect(facts.home.position).toEqual([0, 0, 4])
    expect(facts.home.target).toEqual([0, 0, 0])
    expect(facts.home.distance).toBe(4)
    expect(facts.home.polarDegrees).toBe(90)
    expect(facts.home.azimuthDegrees).toBe(0)
  })

  it('reads every close-up view beside the home view, keyed by its id', () => {
    // The driver close-up moves in to 1.5 in front of the center: its own
    // orbit numbers, not the home's, come back under its id.
    const doc = documentWith()
    nodeNamed(doc, 'CAM_driver').setTranslation([1, 1, 1.5])
    const facts = productCameraFactsOf(doc, MODEL_PATH)
    expect([...facts.closeUps.keys()]).toEqual(['driver'])
    const driver = facts.closeUps.get('driver')
    expect(driver?.position).toEqual([0, 0, 1.5])
    expect(driver?.target).toEqual([0, 0, 0])
    expect(driver?.distance).toBe(1.5)
    expect(driver?.aspect).toBe(PASSING_CAMERA_POSE.aspect)
    expect(facts.home.distance).toBe(4)
  })

  it('fails by name on a close-up that is not perspective', () => {
    const doc = documentWith()
    nodeNamed(doc, 'CAM_driver').setCamera(doc.createCamera('driver-ortho').setType('orthographic'))
    expect(() => productCameraFactsOf(doc, MODEL_PATH)).toThrow(
      'CAM_driver in fixture/model.glb carries no perspective camera',
    )
  })

  it('fails by name on a home camera with no aspect ratio', () => {
    expect(() =>
      productCameraFactsOf(
        documentWith({ cameraPose: { ...PASSING_CAMERA_POSE, aspect: null } }),
        MODEL_PATH,
      ),
    ).toThrow('CAM_home in fixture/model.glb carries no aspect ratio')
  })

  it('fails by name when the document holds no home camera', () => {
    expect(() =>
      productCameraFactsOf(documentWith({ cameraNames: ['CAM_driver'] }), MODEL_PATH),
    ).toThrow('no CAM_home node in fixture/model.glb')
  })
})
