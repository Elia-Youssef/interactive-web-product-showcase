// The grids the pipeline's geometry storage writes on, derived from the
// pipeline's own encoders, never restated: the Int16 magnitudes the
// quantize step writes a position component as at the pipeline's position
// bits, and the key bits of a translation key stored through the meshopt
// EXPONENTIAL filter, read from the mantissas the filter stores. The
// storage rule holds each file's stored values against these grids, so a
// file written at other settings fails by its bytes, whatever its accessor
// types say.
import { Document, Logger } from '@gltf-transform/core'
import { quantize } from '@gltf-transform/functions'

// Every Int16 magnitude the quantize step can store a normalized position
// component as at the given bits: the encoder run over every quantization
// level of the unit range, in the accessor's own [-1, 1] space (a mesh
// volume of exactly [-1, 1] keeps the volume remap the identity). The set
// holds one magnitude per level, which the derivation checks.
export async function positionGridOf(positionBits: number): Promise<ReadonlySet<number>> {
  const levels = Math.pow(2, positionBits - 1) - 1
  const values = Array.from({ length: levels + 1 }, (_, level) => level / levels)
  // The quantize run logs what it cleans up; the derivation reads its output.
  const doc = new Document().setLogger(new Logger(Logger.Verbosity.SILENT))
  doc.createBuffer()
  const scene = doc.createScene('Scene')
  const primitive = doc.createPrimitive().setAttribute(
    'POSITION',
    doc
      .createAccessor('levels')
      .setType('VEC3')
      .setArray(
        new Float32Array([-1, -1, -1, ...values.flatMap((value) => [value, value, value])]),
      ),
  )
  scene.addChild(doc.createNode('grid').setMesh(doc.createMesh('grid').addPrimitive(primitive)))
  await doc.transform(quantize({ quantizePosition: positionBits, quantizationVolume: 'mesh' }))
  const stored = primitive.getAttribute('POSITION')?.getArray() ?? []
  const magnitudes = new Set(Array.from(stored, (value) => Math.abs(value)))
  if (magnitudes.size !== levels + 1) {
    throw new Error(
      `the quantize run at ${positionBits} bits answered ${magnitudes.size} magnitudes ` +
        `for ${levels + 1} levels`,
    )
  }
  return magnitudes
}

// The fewest key bits that hold a stored EXPONENTIAL mantissa of the given
// magnitude: the filter stores a key component as a signed mantissa of at
// most 2^(bits - 1) over a shared exponent, so a file written at more bits
// than the pipeline's stores larger mantissas.
export function keyBitsOfMantissa(magnitude: number): number {
  if (!Number.isInteger(magnitude) || magnitude < 0) {
    throw new Error(`a stored mantissa magnitude is a whole number, got ${magnitude}`)
  }
  return magnitude <= 1 ? 1 : 1 + Math.ceil(Math.log2(magnitude))
}
