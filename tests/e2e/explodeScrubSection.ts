import type { Page } from '@playwright/test'
import { loadCollection } from './productList'
import { explodeScrubName } from '../../src/lib/copy/productPanel'
import { siteCopy } from '../../src/lib/copy/site'

// The exploded view's scrub section as its specs read it: the first shipped
// product, the section's two accessible names, and the locators of its two
// elements, shared by the app panel spec and the mount spec beside it.

export const product = (await loadCollection()).first

export const toggleLabel = product.explode.label ?? siteCopy.defaultExplodeLabel
export const scrubName = explodeScrubName(product)

export const readoutOf = (page: Page) => page.locator('[data-explode-readout]')
export const sliderOf = (page: Page) => page.getByRole('slider', { name: scrubName })
