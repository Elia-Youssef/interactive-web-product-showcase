// The validate step on planted products whose bytes the home fit cannot
// take at face value: positions stored at another width than the pipeline
// writes, and a home camera with geometry behind its plane. Each one is a
// named violation in the product's own report, never a crash of the run.
import { describe, expect, it } from 'vitest'
import { TOOL_FIXTURE_TIMEOUT_MS } from '../tooling/subprocess.fixtures.ts'
import type { Document } from '@gltf-transform/core'
import { loadParseProduct } from './manifestIo.ts'
import { withTempDir, type OptimizeOverrides } from './optimizedModel.fixtures.ts'
import { plantProduct } from './plantedProduct.fixtures.ts'
import { POSITION_QUANTIZE_BITS } from './settings.ts'
import { positionGridOf, type PositionGrid } from './storageGrid.ts'
import { validateShippedProduct } from './validateProduct.ts'
import type { ProductValidation } from './validateChecks.ts'
import { buildDocument, PASSING_CAMERA_POSE } from './validateFixtures.ts'

const SLUG = 'probe-speaker'

// The grid the run passes down: the pipeline's own, unless a probe names one.
const PIPELINE_GRID = await positionGridOf(POSITION_QUANTIZE_BITS)

async function validatePlanted(
  doc: Document,
  overrides: OptimizeOverrides = {},
  positionGrid: PositionGrid = PIPELINE_GRID,
): Promise<ProductValidation> {
  return withTempDir(async (root) => {
    await plantProduct(root, SLUG, doc, overrides)
    return validateShippedProduct(root, SLUG, await loadParseProduct(), positionGrid)
  })
}

function messagesOf(validation: ProductValidation, group: string, rule: string): string[] {
  const check = validation.checks.find((candidate) => candidate.name === group)
  return (check?.violations ?? []).filter((message) => message.startsWith(`${rule}:`))
}

describe(
  'the validate step on bytes the home fit cannot take at face value',
  { timeout: TOOL_FIXTURE_TIMEOUT_MS },
  () => {
    it('measures Int8 positions and names their storage', async () => {
      const validation = await validatePlanted(
        buildDocument({ hotspotNames: ['HS_driver', 'HS_knob'] }),
        { quantizePosition: 8 },
      )
      expect(validation.slug).toBe(SLUG)
      expect(messagesOf(validation, 'model', 'storage-matches-pipeline')).toEqual(
        ['PART_base', 'PART_knob', 'body-variants', 'shadow'].map(
          (mesh) =>
            `storage-matches-pipeline: the POSITION of the mesh '${mesh}' is stored as component ` +
            "type 5120, normalized, the pipeline's 14-bit quantize stores normalized Int16",
        ),
      )
      expect(messagesOf(validation, 'cameras', 'home-holds-both-poses')).toEqual([])
    })

    it('holds the stored positions against the grid it is given, not a fixed one', async () => {
      const doc = () => buildDocument({ hotspotNames: ['HS_driver', 'HS_knob'] })
      const atPipeline = await validatePlanted(doc())
      expect(messagesOf(atPipeline, 'model', 'storage-matches-pipeline')).toEqual([])
      // The same bytes against the grid of another width: the one mesh whose
      // stored values are not corners of the unit cube falls off it, by the
      // bytes alone, in the model group's own report.
      const bits = POSITION_QUANTIZE_BITS - 4
      const offGrid = await validatePlanted(doc(), {}, await positionGridOf(bits))
      expect(messagesOf(offGrid, 'model', 'storage-matches-pipeline')).toEqual([
        "storage-matches-pipeline: the POSITION of the mesh 'shadow' holds 4 stored values " +
          `off the grid of the pipeline's ${bits}-bit quantize`,
      ])
    })

    it.each([10, 12, 16])(
      'names the given %i-bit grid when position storage has the wrong type',
      async (bits) => {
        const validation = await validatePlanted(
          buildDocument({ hotspotNames: ['HS_driver', 'HS_knob'] }),
          { quantizePosition: 8 },
          await positionGridOf(bits),
        )
        expect(messagesOf(validation, 'model', 'storage-matches-pipeline')).toEqual(
          ['PART_base', 'PART_knob', 'body-variants', 'shadow'].map(
            (mesh) =>
              `storage-matches-pipeline: the POSITION of the mesh '${mesh}' is stored as component ` +
              `type 5120, normalized, the pipeline's ${bits}-bit quantize stores normalized Int16`,
          ),
        )
      },
    )

    it('names a home camera with geometry behind its plane', async () => {
      const validation = await validatePlanted(
        buildDocument({
          hotspotNames: ['HS_driver', 'HS_knob'],
          cameraPose: { ...PASSING_CAMERA_POSE, position: [1, 1, -0.5] },
        }),
      )
      expect(validation.slug).toBe(SLUG)
      expect(messagesOf(validation, 'cameras', 'home-holds-both-poses')).toEqual([
        'home-holds-both-poses: the assembled pose cannot be framed at home: ' +
          'a point of the PART_knob mesh lies behind the home camera plane',
        'home-holds-both-poses: the exploded pose cannot be framed at home: ' +
          'a point of the PART_knob mesh lies behind the home camera plane',
      ])
    })
  },
)
