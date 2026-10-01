import { useLayoutEffect } from 'react'
import type { Product } from '@lib/product'
import { useAppStore } from '@store/index'

// The one offer of a product's finishes, in one hook: it writes the
// manifest's finishes under the product's slug into the store's finish
// slice, in manifest order with the default first. The panel and the
// product harness both call it, so every composition that shows finish
// controls offers them exactly once.
//
// The offer runs in a layout effect, so the painted first frame already
// shows the default finish as active. The offer names the product, so the
// first render of a switched product still reads its own default, never the
// last product's choice; and the same product with the same variants is the
// same offer in the slice, so a remount keeps the user's selection.
export function useFinishOffer(product: Product): void {
  const finishOffered = useAppStore((state) => state.finishOffered)

  useLayoutEffect(() => {
    finishOffered(
      product.slug,
      product.finishes.map((finish) => finish.variant),
    )
  }, [finishOffered, product])
}
