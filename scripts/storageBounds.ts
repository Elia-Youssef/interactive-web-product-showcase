// The storage bounds the contract's home-fit rule is stated in, derived
// from the pipeline's own geometry storage: how far the optimize step's
// encode and the viewer's decode can move one position component, and how
// far the key filter can move one translation key component. Both bounds
// are computed, never picked: the position bound runs the same quantize
// transform the optimize stage runs over every value its encoder can
// answer, and reads the error back the way the glTF core decodes a
// normalized Int16; the key bound is the exponent form of the meshopt
// EXPONENTIAL filter the meshopt writer applies to translation outputs.

import { Document, MathUtils } from '@gltf-transform/core'
import { quantize } from '@gltf-transform/functions'
import { KEY_FILTER_BITS, POSITION_QUANTIZE_BITS } from './settings.ts'

// The derived bounds one rule input carries, as plain data: how far the
// pipeline's position storage can move one normalized component. Derived
// once per input by the caller, so the rule table stays a pure sync
// function over its facts.
export type StorageBounds = {
  readonly positionNormalizedError: number
}

export async function deriveStorageBounds(): Promise<StorageBounds> {
  return { positionNormalizedError: await derivePositionStorageError(POSITION_QUANTIZE_BITS) }
}

// The component type of a normalized signed 16-bit accessor.
const INT16_COMPONENT_TYPE = 5122

// How far one normalized position component can sit from the value the
// optimize step encoded it from: the worst error over the whole value
// space, computed by running the pipeline's own encode (gltf-transform's
// quantize at the given bits, mesh volume, the accessor's own [-1, 1]
// space after the volume remap) and decoding with the core's normalized
// Int16 rule. The sample set is exact rather than statistical: for every
// magnitude the encoder's rounding can answer, both rounding-boundary
// edges and the bin center, on both signs, so the measured maximum is the
// true bound of the encode/decode to one float32 rounding of a boundary.
export async function derivePositionStorageError(positionBits: number): Promise<number> {
  const samples = boundarySamples(positionBits)
  const doc = new Document()
  doc.createBuffer()
  doc.createScene('Scene')
  const mesh = doc.createMesh('storage-bound')
  const primitive = doc.createPrimitive()
  primitive.setAttribute(
    'POSITION',
    doc.createAccessor('positions').setType('VEC3').setArray(samples.stored),
  )
  mesh.addPrimitive(primitive)
  const scene = doc.getRoot().listScenes()[0]
  if (scene === undefined) {
    throw new Error('the storage-bound scene is missing')
  }
  scene.addChild(doc.createNode('PART_storage').setMesh(mesh))
  await doc.transform(quantize({ quantizePosition: positionBits, quantizationVolume: 'mesh' }))
  const source = primitive.getAttribute('POSITION')?.getArray() ?? null
  if (source === null || source.length !== samples.values.length * 3) {
    throw new Error('the quantize run did not answer every boundary sample')
  }
  let worst = 0
  for (let i = 0; i < samples.values.length; i += 1) {
    for (let component = 0; component < 3; component += 1) {
      const stored = source[i * 3 + component] ?? 0
      const decoded = MathUtils.decodeNormalizedInt(stored, INT16_COMPONENT_TYPE)
      worst = Math.max(worst, Math.abs(decoded - (samples.values[i] ?? 0)))
    }
  }
  return worst
}

// The boundary sample set of one quantize setting: the float32 values, and
// the same values as a VEC3 accessor array (each value on all three
// components), over the accessor's own [-1, 1] space. The mesh volume of
// these samples is exactly [-1, 1], so the volume remap is the identity
// and the encoder answers every sample in its own terms.
function boundarySamples(positionBits: number): {
  readonly values: readonly number[]
  readonly stored: Float32Array<ArrayBuffer>
} {
  const quantBits = positionBits - 1
  if (quantBits < 1 || quantBits > 15) {
    throw new Error(`position storage error needs bits in [2, 16], got ${positionBits}`)
  }
  const scale = Math.pow(2, quantBits) - 1
  const values: number[] = []
  for (let m = 0; m <= scale; m += 1) {
    for (const sample of [(m - 0.5) / scale, m / scale, (m + 0.5) / scale]) {
      for (const sign of [1, -1]) {
        values.push(Math.min(1, Math.max(-1, sample * sign)))
      }
    }
  }
  const storedArray = new Float32Array(new ArrayBuffer(values.length * 12))
  values.forEach((value, index) => {
    storedArray[index * 3] = value
    storedArray[index * 3 + 1] = value
    storedArray[index * 3 + 2] = value
  })
  return { values, stored: storedArray }
}

// How far one component of a stored translation key can sit from the value
// it was authored from: the meshopt EXPONENTIAL filter's step at the
// pipeline's key bits, over the key's own largest component. The filter
// stores a key as an integer mantissa over one shared exponent chosen so
// the key's largest component fits the 12 signed bits, so no component of
// the key moves by more than 2^-(bits-1) of that largest magnitude;
// verified against the installed encoder's round trip at magnitudes from
// 2^-25 to 2.5, where the worst error sat under 0.91 of this bound.
export function translationKeyComponentBound(keyComponents: readonly number[]): number {
  if (keyComponents.length === 0) {
    throw new Error('a translation key carries at least one component')
  }
  const largest = Math.max(...keyComponents.map((component) => Math.abs(component)))
  return Math.pow(2, 1 - KEY_FILTER_BITS) * largest
}
