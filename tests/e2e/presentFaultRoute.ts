import type { Page } from '@playwright/test'
import type { Product } from '../../src/lib/product'
import { composeTestModule } from './composeTestModule'

// Substitute only the module boundary with a test composition. The query
// imports the untouched product module, bypassing this route, and Vite
// transforms the React fixture normally. No production fault path is added.
export async function faultProductPresent(page: Page, product: Product): Promise<() => number> {
  return composeTestModule(page, {
    path: '/src/viewer/product/Product.tsx',
    name: 'Product',
    fixture: '/tests/fixtures/presentFault.fixtures.tsx',
    compose: 'renderWithPresentFault',
    args: [product.slug],
  })
}
