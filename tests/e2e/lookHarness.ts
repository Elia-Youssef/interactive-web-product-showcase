import type { Page } from '@playwright/test'
import { MathUtils } from 'three'
import type { ProductLookValues } from '../../src/lib/product'
import { testBodyBudgetMs } from './budgets'
import { expectPoll, harnessPath } from './productSpecs'

// The harness URL for a look run: the product's slug parameter, plus the
// optional look parameter as JSON. An undefined look loads the product with
// whatever its manifest carries, exactly as the production path does.
export function lookHarnessPath(backendPath: string, slug: string, look?: unknown): string {
  if (look === undefined) {
    return harnessPath(backendPath, slug)
  }
  return `${harnessPath(backendPath, slug)}&look=${encodeURIComponent(JSON.stringify(look))}`
}

// Reads the applied values from the live renderer, scene and shadow material.
// The scene stores its rotation in radians and the probe returns degrees, so
// the expected angle takes the same unit round trip. The comparison remains
// exact without mistaking conversion precision for a different rotation.
export async function expectAppliedLook(page: Page, expected: ProductLookValues): Promise<void> {
  await expectPoll(
    page,
    () => {
      const look = window.__viewer?.look ?? null
      if (look === null) {
        return null
      }
      return {
        exposure: look.exposure,
        environmentIntensity: look.environmentIntensity,
        environmentRotationDeg: look.environmentRotationDeg,
        shadow: look.shadow,
      }
    },
    testBodyBudgetMs,
  ).toEqual({
    exposure: expected.exposure,
    environmentIntensity: expected.environmentIntensity,
    environmentRotationDeg: MathUtils.radToDeg(MathUtils.degToRad(expected.environmentRotationDeg)),
    shadow: {
      opacity: expected.shadowOpacity,
      transparent: true,
      depthWrite: false,
    },
  })
}

// The stage box on the harness page, in CSS pixels. The harness frame fills
// the viewport and the stage fills the frame, so its canvas is the whole
// stage; the pixel specs compare captures over this box. The caller waits
// for the product to be ready first: before the renderer starts, the canvas
// sits at its unsized default and a box read then would be wrong.
export async function harnessStageBox(page: Page) {
  const canvas = page.locator('main canvas')
  const box = await canvas.boundingBox()
  if (box === null) {
    throw new Error('the harness stage canvas must have a bounding box')
  }
  return box
}
