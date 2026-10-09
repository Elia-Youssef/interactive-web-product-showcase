import type { Page } from '@playwright/test'
import type { Product } from '../../src/lib/product'

// Substitute only the module boundary with a test composition. The query
// imports the untouched product module, bypassing this route, and Vite
// transforms the React fixture normally. No production fault path is added.
export async function faultProductPresent(page: Page, product: Product): Promise<() => number> {
  let substitutions = 0
  await page.route('**/src/viewer/product/Product.tsx*', async (route) => {
    if (new URL(route.request().url()).searchParams.has('originalProduct')) {
      await route.continue()
      return
    }
    substitutions += 1
    await route.fulfill({
      contentType: 'text/javascript',
      body: `
        import { Product as OriginalProduct } from '/src/viewer/product/Product.tsx?originalProduct';
        import { renderWithPresentFault } from '/tests/fixtures/presentFault.fixtures.tsx';
        export function Product(props) {
          return renderWithPresentFault(OriginalProduct, props, ${JSON.stringify(product.slug)});
        }
      `,
    })
  })
  return () => substitutions
}
