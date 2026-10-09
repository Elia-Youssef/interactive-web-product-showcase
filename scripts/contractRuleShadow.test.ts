import { describe, expect, it } from 'vitest'
import { buildDocument } from './validateFixtures.ts'
import { plantProduct } from './plantedProduct.fixtures.ts'
import { withTempDir } from './optimizedModel.fixtures.ts'
import { loadParseProduct } from './manifestIo.ts'
import { validateShippedProduct } from './validateProduct.ts'
import { setShadowFixture } from './shadowProduct.fixtures.ts'
import { POSITION_QUANTIZE_BITS } from './settings.ts'
import { positionGridOf } from './storageGrid.ts'

const POSITION_GRID = await positionGridOf(POSITION_QUANTIZE_BITS)

describe('shadow findings through the shipped product validator', () => {
  it.each([
    { name: 'unchanged', grow: 0, shrink: 0, findings: false },
    { name: 'alpha grown two texels', grow: 2, shrink: 0, findings: true },
    { name: 'plane shrunk two texels', grow: 0, shrink: 2, findings: true },
  ])('$name reports the parity warning level', async ({ grow, shrink, findings }) => {
    await withTempDir(async (root) => {
      const doc = buildDocument({ hotspotNames: ['HS_driver', 'HS_knob'] })
      setShadowFixture(doc, grow, shrink)
      await plantProduct(root, 'planted-shadow', doc)
      const result = await validateShippedProduct(
        root,
        'planted-shadow',
        await loadParseProduct(),
        POSITION_GRID,
      )
      const warnings = result.checks
        .flatMap((check) => check.warnings)
        .filter((message) => message.startsWith('shadow-footprint-fits-plane:'))
      const violations = result.checks
        .flatMap((check) => check.violations)
        .filter((message) => message.startsWith('shadow-'))
      expect(violations).toEqual([])
      if (findings) {
        expect(warnings).toHaveLength(4)
        expect(warnings.every((message) => message.includes('limit 12 texels'))).toBe(true)
      } else expect(warnings).toEqual([])
    })
  })

  it('reports border clipping as a violation', async () => {
    await withTempDir(async (root) => {
      const doc = buildDocument({ hotspotNames: ['HS_driver', 'HS_knob'] })
      setShadowFixture(doc, 16)
      await plantProduct(root, 'clipped-shadow', doc)
      const result = await validateShippedProduct(
        root,
        'clipped-shadow',
        await loadParseProduct(),
        POSITION_GRID,
      )
      const violations = result.checks
        .flatMap((check) => check.violations)
        .filter((message) => message.startsWith('shadow-alpha-clear-at-border:'))
      expect(violations).toEqual([
        'shadow-alpha-clear-at-border: SHADOW border alpha 1.000000 exceeds threshold 0.03 by 0.970000',
      ])
    })
  })
})
