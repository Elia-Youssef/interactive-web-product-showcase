// The geometry storage file against the numbers it states: the validate
// constants are its values, the geometry stage really quantizes positions
// at its position bits, and the meshopt writer really filters translation
// keys at its key bits. A gltf-transform upgrade that moved either fails
// here, before the storage bounds or the authoring side's camera fit drift
// from the files the pipeline writes.
import { readFileSync } from 'node:fs'
import { Document, NodeIO } from '@gltf-transform/core'
import { EXTMeshoptCompression } from '@gltf-transform/extensions'
import { MESHOPT_DEFAULTS } from '@gltf-transform/functions'
import { MeshoptDecoder, MeshoptEncoder } from 'meshoptimizer'
import { describe, expect, it } from 'vitest'
import { GEOMETRY_STORAGE_FILE } from './geometryStorage.ts'
import { buildGeometryStageArgs } from './pipeline.ts'
import {
  DEFAULT_OPTIMIZE_SETTINGS,
  GEOMETRY_STORAGE,
  KEY_FILTER_BITS,
  POSITION_QUANTIZE_BITS,
  resolveGeometryStorage,
  SettingsError,
} from './settings.ts'

// One translation channel's keys, each a VEC3. The second components sit
// between the encoder's steps at neighbouring bit counts, so the filter's
// output tells the bit count apart.
const KEYS = [2459 / 8192, 0.05, 0, 1229.25 / 4096, -0.0172, 0.031] as const
const TRANSLATION_STRIDE_BYTES = 12

// The keys as the meshopt EXPONENTIAL filter stores them at the given
// mantissa bits and as a reader decodes them: each 32-bit word holds a
// signed 24-bit mantissa under a signed 8-bit exponent.
function exponentialFilterRoundTrip(keys: readonly number[], bits: number): number[] {
  const encoded = MeshoptEncoder.encodeFilterExp(
    new Float32Array(keys),
    keys.length / 3,
    TRANSLATION_STRIDE_BYTES,
    bits,
  )
  const words = new Int32Array(encoded.buffer, encoded.byteOffset, encoded.byteLength / 4)
  return Array.from(words, (word) => ((word << 8) >> 8) * Math.pow(2, word >> 24))
}

// The keys after a write and read through the meshopt writer, the way the
// optimize step's geometry stage writes them (the FILTER method of its
// high level).
async function keysThroughTheWriter(keys: readonly number[]): Promise<number[]> {
  await Promise.all([MeshoptEncoder.ready, MeshoptDecoder.ready])
  const doc = new Document()
  const buffer = doc.createBuffer()
  const node = doc.createNode('PART_key')
  doc.createScene('Scene').addChild(node)
  const sampler = doc
    .createAnimationSampler()
    .setInterpolation('LINEAR')
    .setInput(
      doc
        .createAccessor('times')
        .setType('SCALAR')
        .setArray(new Float32Array([0, 1]))
        .setBuffer(buffer),
    )
    .setOutput(
      doc.createAccessor('keys').setType('VEC3').setArray(new Float32Array(keys)).setBuffer(buffer),
    )
  const channel = doc
    .createAnimationChannel()
    .setTargetNode(node)
    .setTargetPath('translation')
    .setSampler(sampler)
  doc.createAnimation('Explode').addSampler(sampler).addChannel(channel)
  doc
    .createExtension(EXTMeshoptCompression)
    .setRequired(true)
    .setEncoderOptions({ method: EXTMeshoptCompression.EncoderMethod.FILTER })
  const io = new NodeIO()
    .registerExtensions([EXTMeshoptCompression])
    .registerDependencies({ 'meshopt.encoder': MeshoptEncoder, 'meshopt.decoder': MeshoptDecoder })
  const back = await io.readBinary(await io.writeBinary(doc))
  const output = back.getRoot().listAnimations()[0]?.listSamplers()[0]?.getOutput()?.getArray()
  if (output === undefined || output === null) {
    throw new Error('the written clip came back without its key output')
  }
  return Array.from(output)
}

describe('the geometry storage file', () => {
  it('is what the validate constants read', () => {
    const raw: unknown = JSON.parse(readFileSync(GEOMETRY_STORAGE_FILE, 'utf8'))
    expect(raw).toEqual({
      positionQuantizeBits: POSITION_QUANTIZE_BITS,
      translationKeyFilterBits: KEY_FILTER_BITS,
    })
    expect(GEOMETRY_STORAGE).toEqual(raw)
  })

  it('states the position bits the geometry stage quantizes with', () => {
    // The stage passes no quantize option to optimize, so the meshopt
    // transform's own defaults decide the bits.
    const args = buildGeometryStageArgs('in.glb', 'out.glb', DEFAULT_OPTIMIZE_SETTINGS)
    expect(args.filter((arg) => arg.startsWith('--quantize'))).toEqual([])
    expect(MESHOPT_DEFAULTS.quantizePosition).toBe(POSITION_QUANTIZE_BITS)
  })

  it('states the key bits the meshopt writer filters translation keys with', async () => {
    await MeshoptEncoder.ready
    const atBits = exponentialFilterRoundTrip(KEYS, KEY_FILTER_BITS)
    expect(atBits).not.toEqual(exponentialFilterRoundTrip(KEYS, KEY_FILTER_BITS - 1))
    expect(atBits).not.toEqual(exponentialFilterRoundTrip(KEYS, KEY_FILTER_BITS + 1))
    expect(await keysThroughTheWriter(KEYS)).toEqual(atBits)
  })

  it('refuses bits outside what the encoders take, naming the file and the field', () => {
    const outside = '{"positionQuantizeBits": 17, "translationKeyFilterBits": 0}'
    try {
      resolveGeometryStorage(outside, 'storage.json')
      expect.unreachable()
    } catch (error) {
      expect(error).toBeInstanceOf(SettingsError)
      const settingsError = error as SettingsError
      expect(settingsError.source).toBe('storage.json')
      expect(settingsError.issues.map((issue) => issue.path)).toEqual([
        'positionQuantizeBits',
        'translationKeyFilterBits',
      ])
    }
  })

  it('refuses an unknown field and a file that is no JSON', () => {
    expect(() =>
      resolveGeometryStorage(
        '{"positionQuantizeBits": 14, "translationKeyFilterBits": 12, "normalBits": 8}',
        'storage.json',
      ),
    ).toThrow(/normalBits: unknown key/)
    expect(() => resolveGeometryStorage('{', 'storage.json')).toThrow(/expected valid JSON/)
  })
})
