import { expect, type Page } from '@playwright/test'
import { siteCopy } from '../../src/lib/copy/site'
import type { Product, ProductCollection } from '../../src/lib/product'
import { formatProductPath } from '../../src/lib/routing'
import { stepLabel } from '../../src/features/collection/collection.logic'
import { routePath } from './appPaths'
import { productLoadBudgetMs } from './budgets'
import { waitForProductReady } from './productSpecs'

// The reads and expectations of the collection spec: the collection's own
// neighbors, the row's controls by accessible name, and the wait for a
// product the page presents.

// The path and query of an absolute page URL, the form the href attributes
// and the app's own navigation spell.
export function urlPath(url: string): string {
  const parsed = new URL(url)
  return parsed.pathname + parsed.search
}

// The collection's neighbor of one product, or the loud error it is when
// the slug is not the collection's own.
export function neighborsOf(collection: ProductCollection, product: Product) {
  const neighbors = collection.neighbors(product.slug)
  if (neighbors === undefined) {
    throw new Error(`the collection holds no product '${product.slug}'`)
  }
  return neighbors
}

// The row's controls of one product, located by their accessible names.
export function rowControls(page: Page, collection: ProductCollection, product: Product) {
  const neighbors = neighborsOf(collection, product)
  return {
    counter: page.getByRole('button', { name: siteCopy.openIndexLabel }),
    previous: page.getByRole('link', {
      name: stepLabel(siteCopy.previousLabel, neighbors.previous),
    }),
    next: page.getByRole('link', { name: stepLabel(siteCopy.nextLabel, neighbors.next) }),
    neighbors,
  }
}

// The page presents the product: the automation hook names it and the
// product is on a recorded frame.
export async function expectProduct(page: Page, product: Product): Promise<void> {
  await expect
    .poll(() => page.evaluate(() => window.__viewer?.productSlug ?? null), {
      timeout: productLoadBudgetMs,
    })
    .toBe(product.slug)
  await waitForProductReady(page)
}

// The app path of a product, with the backend mode's query on it.
export function productPathOf(backendPath: string, product: Product): string {
  return routePath(backendPath, formatProductPath(product.slug))
}
