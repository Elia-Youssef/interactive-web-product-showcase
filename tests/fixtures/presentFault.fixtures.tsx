import { createElement, type ComponentProps } from 'react'
import type { Product } from '../../src/viewer/product/Product'
import { HarnessFrameFault } from '../../src/app/product-harness/HarnessFrameFault'

// Compose the same harness fault inside the real product, selected by the
// test's collection data. The app's loading, ownership and reports stay real.
export function renderWithPresentFault(
  component: typeof Product,
  props: ComponentProps<typeof Product>,
  faultSlug: string,
) {
  return createElement(
    component,
    props,
    props.children,
    props.manifest.slug === faultSlug
      ? createElement(HarnessFrameFault, { fault: { place: 'present', scope: 'product' } })
      : null,
  )
}
