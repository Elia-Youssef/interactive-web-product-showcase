import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import type { ProductInput } from '@lib/product'
import { productManifests } from '@products/index'
import { ProductHarnessPage } from './ProductHarnessPage'

// The harness page's entry, and the one place its product set is composed:
// the shipped index plus the fixture products, read the same way the
// shipped index reads its folder (src/products/index.ts), the manifest
// marker over the fixture folder, derived, never hand-kept. Composing the
// set is test support, so this entry is a fixture module: the lint gate's
// fixture rule lets it, and nothing in production, reach the fixture
// manifests, and the page itself takes its products as data. The page is
// dev-only: the production build's only input is index.html, so neither
// this entry nor a fixture manifest rides the build or the dist output.
const fixtureModules = import.meta.glob<ProductInput>('/tests/fixtures/products/*/*.fixtures.ts', {
  eager: true,
  import: 'manifest',
})

const harnessProducts: readonly ProductInput[] = [
  ...productManifests,
  ...Object.values(fixtureModules),
]

const rootElement = document.getElementById('root')

if (rootElement === null) {
  throw new Error('The #root element is missing from product-harness.html')
}

createRoot(rootElement).render(
  <StrictMode>
    <ProductHarnessPage products={harnessProducts} />
  </StrictMode>,
)
