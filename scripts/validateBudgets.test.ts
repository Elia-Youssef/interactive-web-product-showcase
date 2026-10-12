// The budget check's own cases: the model size, the texture edge, the draw
// calls, and the unreadable texture size. The facts are plain data, so no
// document is needed; the passing fixture is the budget that passes.
import { describe, expect, it } from 'vitest'
import type { BudgetFacts } from './validateChecks.ts'
import { checkBudgets } from './validateChecks.ts'

const ktx2Body: BudgetFacts['textures'][number] = {
  label: 'BC_body',
  mimeType: 'image/ktx2',
  dimensions: [1024, 1024],
}

const passingBudgets: BudgetFacts = { fileBytes: 1000, textures: [ktx2Body], drawCalls: 5 }

describe('the budget check', () => {
  it('reports a file over the model budget', () => {
    const result = checkBudgets({ ...passingBudgets, fileBytes: 5 * 1024 * 1024 })
    expect(result.violations).toEqual(['file size 5.00 MB exceeds the 4.00 MB model budget'])
  })

  it('reports a texture over the edge budget', () => {
    const result = checkBudgets({
      ...passingBudgets,
      textures: [{ label: 'BC_big', mimeType: 'image/ktx2', dimensions: [4096, 4096] }],
    })
    expect(result.violations).toEqual([
      `texture 'BC_big' is 4096x4096 px, over the 2048 px texture edge budget`,
    ])
  })

  it('reports draw calls over the budget', () => {
    const result = checkBudgets({ ...passingBudgets, drawCalls: 51 })
    expect(result.violations).toEqual(['draw calls 51 exceed the 50 draw call budget'])
  })

  it('reports a texture whose size is unreadable', () => {
    const result = checkBudgets({
      ...passingBudgets,
      textures: [{ label: 'BC_odd', mimeType: 'image/ktx2', dimensions: null }],
    })
    expect(result.violations).toEqual([`texture 'BC_odd' has no readable size`])
  })
})
