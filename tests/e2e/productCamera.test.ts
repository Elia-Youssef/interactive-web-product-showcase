// The authored camera facts the e2e specs derive their expectations from,
// over in-memory contract documents: the frame center and home view from
// the shared document facts, and the loud failure on a home camera with no
// aspect ratio, the silent default the build-time validate step rejects.
import { describe, expect, it } from 'vitest'
import { productCameraFactsOf } from './productCamera'
import {
  buildDocument,
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
