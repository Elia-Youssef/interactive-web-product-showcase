// Cases for the optional look block: each field at each boundary, just
// inside and just outside, plus the strict object's unknown key and a
// non-number field.
import { sampleTwoManifest } from '../fixtures'
import { accepts, rejects, type ManifestCase } from './case'

const withLook = (look: unknown): unknown => ({ ...sampleTwoManifest, look })

export const lookCases: readonly ManifestCase[] = [
  accepts(
    'a look block with every field',
    withLook({
      exposure: 1.5,
      environmentIntensity: 1,
      environmentRotationDeg: 0,
      shadowOpacity: 1,
    }),
    'sample-two',
  ),
  accepts('an empty look block', withLook({}), 'sample-two'),
  accepts('a look block with only one field', withLook({ shadowOpacity: 0.5 }), 'sample-two'),

  // Exposure is greater than 0 and at most 4.
  accepts('an exposure at its maximum', withLook({ exposure: 4 }), 'sample-two'),
  accepts('an exposure just above zero', withLook({ exposure: 1e-6 }), 'sample-two'),
  rejects('an exposure above its maximum', withLook({ exposure: 4.000001 }), 'look.exposure'),
  rejects('a zero exposure', withLook({ exposure: 0 }), 'look.exposure'),
  rejects('a negative exposure', withLook({ exposure: -1 }), 'look.exposure'),

  // The environment intensity runs from 0 through 4.
  accepts('a zero environment intensity', withLook({ environmentIntensity: 0 }), 'sample-two'),
  accepts(
    'an environment intensity at its maximum',
    withLook({ environmentIntensity: 4 }),
    'sample-two',
  ),
  rejects(
    'an environment intensity above its maximum',
    withLook({ environmentIntensity: 4.000001 }),
    'look.environmentIntensity',
  ),
  rejects(
    'a negative environment intensity',
    withLook({ environmentIntensity: -0.000001 }),
    'look.environmentIntensity',
  ),

  // The environment rotation runs from 0 up to but excluding 360.
  accepts('a zero environment rotation', withLook({ environmentRotationDeg: 0 }), 'sample-two'),
  accepts(
    'an environment rotation just below a full turn',
    withLook({ environmentRotationDeg: 359.999 }),
    'sample-two',
  ),
  rejects(
    'an environment rotation of a full turn',
    withLook({ environmentRotationDeg: 360 }),
    'look.environmentRotationDeg',
  ),
  rejects(
    'a negative environment rotation',
    withLook({ environmentRotationDeg: -0.001 }),
    'look.environmentRotationDeg',
  ),

  // The shadow opacity runs from 0 through 1.
  accepts('a zero shadow opacity', withLook({ shadowOpacity: 0 }), 'sample-two'),
  accepts('a shadow opacity at its maximum', withLook({ shadowOpacity: 1 }), 'sample-two'),
  rejects(
    'a shadow opacity above its maximum',
    withLook({ shadowOpacity: 1.000001 }),
    'look.shadowOpacity',
  ),
  rejects(
    'a negative shadow opacity',
    withLook({ shadowOpacity: -0.000001 }),
    'look.shadowOpacity',
  ),

  rejects('an unknown key inside look', withLook({ nope: true }), 'look.nope'),
  rejects('a non-number exposure', withLook({ exposure: 'bright' }), 'look.exposure'),
]
