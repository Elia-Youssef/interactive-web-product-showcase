import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { TOOL_FIXTURE_TIMEOUT_MS } from '../tooling/subprocess.fixtures.ts'
import { createModelIO } from './modelIo.ts'
import { withTempDir, writeOptimizedModel } from './optimizedModel.fixtures.ts'
import { namedNode, preservationFixture } from './preservation.fixtures.ts'
import { readProductPreservation, findPreservationLosses } from './preservationCompare.ts'
import { POSITION_QUANTIZE_BITS } from './settings.ts'

describe('stored geometry round trips', { timeout: TOOL_FIXTURE_TIMEOUT_MS }, () => {
  it.each([0.25, 0.5, 0.75].flatMap((fraction) => [fraction, -fraction]))(
    'accepts normalized position bit replication near grid boundary %s',
    async (fraction) => {
      await withTempDir(async (dir) => {
        const doc = preservationFixture()
        const mesh = namedNode(doc, 'PART_body').getMesh()
        const buffer = doc.getRoot().listBuffers()[0]
        if (mesh === null || buffer === undefined) throw new Error('missing fixture mesh')
        const levels = Math.pow(2, POSITION_QUANTIZE_BITS - 1) - 1
        const x = (Math.sign(fraction) * (Math.floor(levels * Math.abs(fraction)) + 0.49)) / levels
        const positions = [
          [-1, -1, -1, 1, -1, 1, 0, 1, 0],
          [x, -0.25, 0, x, 0.25, 0, x, 0, 0.25],
        ]
        mesh.listPrimitives().forEach((primitive, index) => {
          primitive.setAttribute(
            'POSITION',
            doc
              .createAccessor()
              .setBuffer(buffer)
              .setType('VEC3')
              .setArray(new Float32Array(positions[index] ?? [])),
          )
        })
        const before = readProductPreservation(doc)
        const file = path.join(dir, 'candidate.glb')
        await writeOptimizedModel(doc, file)
        const io = await createModelIO()
        const after = readProductPreservation(await io.read(file))
        expect(findPreservationLosses(before, after)).toEqual([])
      })
    },
  )
})
