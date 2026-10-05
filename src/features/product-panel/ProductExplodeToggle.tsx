import type { Product } from '@lib/product'
import { selectExplodeAttached, selectExplodeOpen, useAppStore } from '@store/index'
import { TextButton } from '@ui/index'
import { explodeToggleLabel } from '@lib/copy/productPanel'

// The exploded view toggle, the panel section after the swatches: a text
// button whose pressed state is the product's exploded view, named by the
// manifest's own word. It is disabled while the product has no attached
// view, so a click before the model is presented cannot arm anything.
export function ProductExplodeToggle({ product }: { product: Product }) {
  const explodeToggle = useAppStore((state) => state.explodeToggle)
  const attached = useAppStore((state) => selectExplodeAttached(state, product.slug))
  const open = useAppStore((state) => selectExplodeOpen(state, product.slug))

  return (
    <TextButton selected={open} disabled={!attached} onClick={() => explodeToggle(product.slug)}>
      {explodeToggleLabel(product)}
    </TextButton>
  )
}
