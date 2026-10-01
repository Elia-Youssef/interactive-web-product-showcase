// The budgets are the documented per-product numbers, and the optimize
// defaults read the texture limit from here, not from a second constant.
import { describe, expect, it } from 'vitest'
import { DRAW_CALLS_MAX, MODEL_BUDGET_BYTES, TEXTURE_MAX_SIZE_PX } from './budgets.ts'
import { DEFAULT_OPTIMIZE_SETTINGS } from './settings.ts'

describe('budgets', () => {
  it('carries the documented per-product budgets', () => {
    expect(MODEL_BUDGET_BYTES).toBe(4 * 1024 * 1024)
    expect(TEXTURE_MAX_SIZE_PX).toBe(2048)
    expect(DRAW_CALLS_MAX).toBe(50)
  })

  it('is the single source of the optimize defaults', () => {
    expect(DEFAULT_OPTIMIZE_SETTINGS.textureMaxSize).toBe(TEXTURE_MAX_SIZE_PX)
  })
})
