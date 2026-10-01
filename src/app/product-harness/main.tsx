import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { ProductHarnessPage } from './ProductHarnessPage'

const rootElement = document.getElementById('root')

if (rootElement === null) {
  throw new Error('The #root element is missing from product-harness.html')
}

createRoot(rootElement).render(
  <StrictMode>
    <ProductHarnessPage />
  </StrictMode>,
)
