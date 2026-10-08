import type { Product } from '@lib/product'
import { selectExplodeAttached, selectExplodeViewState, useAppStore } from '@store/index'
import type { ExplodeViewState } from '@store/index'
import { TextButton } from '@ui/index'
import { explodeToggleLabel } from '@lib/copy/productPanel'

// The pressed announcement of each view state: assembled is unpressed,
// fully open is pressed, and a partly open view after a scrub is mixed.
const pressedOf = {
  assembled: false,
  partial: 'mixed',
  open: true,
} as const satisfies Record<ExplodeViewState, boolean | 'mixed'>

type ExplodeToggleButtonProps = {
  label: string
  view: ExplodeViewState
  disabled: boolean
  onPress: () => void
}

// The button alone, from plain values: the store-bound toggle feeds it, and
// a static render can reach every view state through it.
export function ExplodeToggleButton({ label, view, disabled, onPress }: ExplodeToggleButtonProps) {
  return (
    <TextButton selected={pressedOf[view]} disabled={disabled} onClick={onPress}>
      {label}
    </TextButton>
  )
}

// The exploded view toggle, the panel section after the swatches: a text
// button whose pressed state is the product's exploded view, named by the
// manifest's own word. It is disabled while the product has no attached
// view, so a click before the model is presented cannot arm anything.
export function ProductExplodeToggle({ product }: { product: Product }) {
  const explodeToggle = useAppStore((state) => state.explodeToggle)
  const attached = useAppStore((state) => selectExplodeAttached(state, product.slug))
  const view = useAppStore((state) => selectExplodeViewState(state, product.slug))

  return (
    <ExplodeToggleButton
      label={explodeToggleLabel(product)}
      view={view}
      disabled={!attached}
      onPress={() => explodeToggle(product.slug)}
    />
  )
}
