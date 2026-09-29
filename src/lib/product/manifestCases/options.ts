// Cases for the optional explode and camera settings.
import { sampleThreeManifest, sampleTwoManifest } from '../fixtures'
import { accepts, rejects, type ManifestCase } from './case'

export const optionCases: readonly ManifestCase[] = [
  accepts(
    'an empty explode object, which defaults the clip',
    { ...sampleTwoManifest, explode: {} },
    'sample-two',
  ),
  accepts('an empty camera object', { ...sampleTwoManifest, camera: {} }, 'sample-two'),
  accepts('a camera with only minDistance', sampleThreeManifest, 'sample-three'),
  rejects('an empty explode clip', { ...sampleTwoManifest, explode: { clip: '' } }, 'explode.clip'),
  rejects(
    'an explode label with a line break',
    { ...sampleTwoManifest, explode: { label: 'See\ninside' } },
    'explode.label',
  ),
  rejects(
    'an unknown key inside explode',
    { ...sampleTwoManifest, explode: { nope: true } },
    'explode.nope',
  ),
  rejects(
    'a zero camera distance',
    { ...sampleTwoManifest, camera: { minDistance: 0 } },
    'camera.minDistance',
  ),
  rejects(
    'a negative camera distance',
    { ...sampleTwoManifest, camera: { maxDistance: -1 } },
    'camera.maxDistance',
  ),
  rejects(
    'equal camera distances',
    { ...sampleTwoManifest, camera: { minDistance: 1, maxDistance: 1 } },
    'camera.maxDistance',
  ),
  rejects(
    'a camera range with minDistance above maxDistance',
    { ...sampleTwoManifest, camera: { minDistance: 2, maxDistance: 1 } },
    'camera.maxDistance',
  ),
]
