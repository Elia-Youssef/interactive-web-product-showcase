import { createContext, useCallback, useContext } from 'react'
import type { ShadowFadeClaim, ShadowOpacityHolder } from './shadowOpacityOwner'

// The context that hands the shadow opacity ownership to the loaded
// product's writers. ProductContent provides one holder per presented
// product; ProductLook installs the owner into it, and the features that
// fade the shadow claim their factor through it. R3F bridges the context
// into the canvas, so a feature component that arrives as the product's
// opaque content node reaches the same holder the look installed into.

export const ShadowOpacityContext = createContext<ShadowOpacityHolder | null>(null)

// The shadow opacity holder around the calling component. A component that
// reaches for it outside a loaded product is a composition error, so it
// fails loudly instead of writing against nothing.
export function useShadowOpacityHolder(): ShadowOpacityHolder {
  const holder = useContext(ShadowOpacityContext)
  if (holder === null) {
    throw new Error('the shadow opacity holder is read outside a loaded product')
  }
  return holder
}

// The claim of the shadow's fade factor, for the caller's own effect
// lifetime: set follows the exploded progress, release puts the factor back
// to 1. The claim is taken inside the caller's effect, never during render,
// so its release belongs to that effect's cleanup.
export function useShadowFadeClaim(): () => ShadowFadeClaim {
  const holder = useShadowOpacityHolder()
  return useCallback(() => holder.claimFadeFactor(), [holder])
}
