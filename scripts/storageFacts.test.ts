// The storage facts read from written model files: the translation filter
// reader selects outputs by the channel that reads them, so a rotation
// output, which the meshopt writer stores through its quaternion filter on
// purpose, never reads as a translation output.
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { createModelIO } from './modelIo.ts'
import { writeOptimizedModel, withTempDir } from './optimizedModel.fixtures.ts'
import { declaredTranslationFilters, readTranslationFilters } from './storageFacts.ts'
import { addRotationChannel, buildDocument } from './validateFixtures.ts'

describe('readTranslationFilters', () => {
  it('reads every translation output of a written file and no rotation output', async () => {
    const doc = buildDocument({ hotspotNames: ['HS_driver', 'HS_knob'] })
    addRotationChannel(doc, 'PART_knob')
    const declared = declaredTranslationFilters(doc)
    await withTempDir(async (dir) => {
      const file = path.join(dir, 'model.glb')
      await writeOptimizedModel(doc, file)
      const read = await readTranslationFilters(await createModelIO(), file)
      expect(read).toEqual([
        { animationName: 'Explode', targetName: 'PART_base', filter: 'EXPONENTIAL' },
      ])
      expect(read).toEqual(declared)
    })
  })
})
