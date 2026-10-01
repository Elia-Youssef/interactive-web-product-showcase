import type { Page } from '@playwright/test'
import { harnessPath } from './productSpecs'

// The harness URL for a look run: the product's slug parameter, plus the
// optional look parameter as JSON. An undefined look loads the product with
// whatever its manifest carries, exactly as the production path does.
export function lookHarnessPath(backendPath: string, slug: string, look?: unknown): string {
  if (look === undefined) {
    return harnessPath(backendPath, slug)
  }
  return `${harnessPath(backendPath, slug)}&look=${encodeURIComponent(JSON.stringify(look))}`
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
