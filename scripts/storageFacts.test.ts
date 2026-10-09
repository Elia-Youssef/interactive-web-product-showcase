// The storage facts read from written model files, through the readers the
// validate step runs: the translation reader selects outputs by the channel
// that reads them, so a rotation output, which the meshopt writer stores
// through its quaternion filter on purpose, never reads as a translation
// output; the position reader holds the stored integers against the
// pipeline's quantize grid, so a file quantized at other bits fails by its
// bytes; and the key bits the pipeline names are the ones the installed
// writer stores.
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import type { Document } from '@gltf-transform/core'
import { SHORT_COMPONENT_TYPE } from './componentTypes.ts'
import { createModelIO } from './modelIo.ts'
import {
  writeOptimizedModel,
  withTempDir,
  type OptimizeOverrides,
} from './optimizedModel.fixtures.ts'
import { KEY_FILTER_BITS, POSITION_QUANTIZE_BITS } from './settings.ts'
import {
  declaredTranslationOutputs,
  readPositionStorage,
  readTranslationOutputs,
} from './storageFacts.ts'
import { positionGridOf } from './storageGrid.ts'
import { addRotationChannel, buildDocument, nodeNamed } from './validateFixtures.ts'

// The fixture document with positions inside its mesh volume, so the stored
// integers land between the extremes every grid shares, and with a key whose
// largest component reaches the top of its exponent's mantissa range.
function plantedDocument(): Document {
  const doc = buildDocument({ hotspotNames: ['HS_driver', 'HS_knob'] })
  nodeNamed(doc, 'PART_base')
    .getMesh()
    ?.listPrimitives()[0]
    ?.getAttribute('POSITION')
    ?.setArray(new Float32Array([0, 0, 0, 1, 0.3, 0.1, 0.7, 1, 0.2, 1, 1, 0.55]))
  doc
    .getRoot()
    .listAnimations()[0]
    ?.listSamplers()[0]
    ?.getOutput()
    ?.setArray(new Float32Array([0, 0, 0, 1 - Math.pow(2, -20), 0.5, 0]))
  return doc
}

// The storage facts of the document written as an optimized model.
async function readWritten(doc: Document, overrides: OptimizeOverrides = {}) {
  return withTempDir(async (dir) => {
    const file = path.join(dir, 'model.glb')
    await writeOptimizedModel(doc, file, overrides)
    const io = await createModelIO()
    return {
      positions: readPositionStorage(
        await io.read(file),
        await positionGridOf(POSITION_QUANTIZE_BITS),
      ),
      translationOutputs: await readTranslationOutputs(io, file),
    }
  })
}

const namesOf = (outputs: readonly { animationName: string; targetName: string }[]) =>
  outputs.map(({ animationName, targetName }) => `${animationName} ${targetName}`)

describe('readTranslationOutputs', () => {
  it('reads every translation output of a written file and no rotation output', async () => {
    const doc = plantedDocument()
    addRotationChannel(doc, 'PART_knob')
    const declared = declaredTranslationOutputs(doc)
    const read = await readWritten(doc)
    expect(namesOf(read.translationOutputs)).toEqual(['Explode PART_base'])
    expect(namesOf(read.translationOutputs)).toEqual(namesOf(declared))
    expect(read.translationOutputs.map((output) => output.storage.kind)).toEqual(['exponential'])
  })

  it('reads the key bits the installed writer stores, the pipeline key bits', async () => {
    const read = await readWritten(plantedDocument())
    expect(read.translationOutputs.map((output) => output.storage)).toEqual([
      { kind: 'exponential', keyBits: KEY_FILTER_BITS },
    ])
  })
})

describe('readPositionStorage', () => {
  it('finds every stored position of a pipeline-written file on the pipeline grid', async () => {
    const read = await readWritten(plantedDocument())
    expect(read.positions.length).toBeGreaterThan(0)
    for (const position of read.positions) {
      expect(position.componentType, position.meshName).toBe(SHORT_COMPONENT_TYPE)
      expect(position.offGridValues, position.meshName).toBe(0)
    }
  })

  it('finds the stored positions of a 16-bit file off the pipeline grid', async () => {
    const read = await readWritten(plantedDocument(), { quantizePosition: 16 })
    const base = read.positions.find((position) => position.meshName === 'PART_base')
    expect(base?.componentType).toBe(SHORT_COMPONENT_TYPE)
    expect(base?.normalized).toBe(true)
    expect(base?.offGridValues).toBeGreaterThan(0)
  })
})

describe('positionGridOf', () => {
  it('holds one magnitude per quantize level, the extremes included', async () => {
    const grid = await positionGridOf(POSITION_QUANTIZE_BITS)
    expect(grid.size).toBe(Math.pow(2, POSITION_QUANTIZE_BITS - 1))
    expect(grid.has(0)).toBe(true)
    expect(grid.has(32767)).toBe(true)
  })
})
