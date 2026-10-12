import { useCallback, useEffect, useMemo, useReducer } from 'react'
import type { Product, ProductCollection } from '@lib/product'
import {
  applyProductSwitchEvent,
  initialProductSwitch,
  preloadSlugs,
  type ProductSettleOutcome,
  type ShownLifeOutcome,
} from '@lib/product-switch'
import type { ProductTransitionPhase } from '@lib/transition'

// One product life on the stage: the manifest it shows and the life number
// its mount is keyed by, so every swap mounts a fresh product, and the
// settle report bound to that life alone.
export type ShownProductLife = {
  readonly manifest: Product
  readonly life: number
  readonly outcome: ShownLifeOutcome | 'pending'
  readonly onSettled: (outcome: ProductSettleOutcome) => void
  readonly onStageFailed: () => void
}

export type ProductSwitch = {
  // The phase the transition draws, and its two landing reports.
  readonly phase: ProductTransitionPhase
  readonly onCovered: () => void
  readonly onRevealed: () => void
  // The life the stage shows.
  readonly shown: ShownProductLife
  // The products whose model files the stage reads ahead. The list keeps
  // its identity until the next rest.
  readonly preload: readonly string[]
}

// The one owner of a product switch on the product page: the route's
// product is the target, and the pure switch sequence decides what the
// stage shows and what the transition draws. Every way the route moves
// (a link, back and forward, a deep link to another product, a row of the
// index) reaches the sequence as the same navigation, so there is one path
// and a navigation in any phase retargets the sequence that runs. Nothing
// else drives the transition.
export function useProductSwitch(target: Product, collection: ProductCollection): ProductSwitch {
  const [state, dispatch] = useReducer(applyProductSwitchEvent, target.slug, initialProductSwitch)

  useEffect(() => {
    dispatch({ kind: 'navigated', slug: target.slug })
  }, [target.slug])

  const onCovered = useCallback(() => dispatch({ kind: 'covered' }), [])
  const onRevealed = useCallback(() => dispatch({ kind: 'revealed' }), [])
  const life = state.shown.life
  const onSettled = useCallback(
    (outcome: ProductSettleOutcome) => dispatch({ kind: 'settled', life, outcome }),
    [life],
  )
  const onStageFailed = useCallback(() => dispatch({ kind: 'stage-failed', life }), [life])
  const preload = useMemo(() => preloadSlugs(state.rested, collection), [state.rested, collection])

  return {
    phase: state.phase,
    onCovered,
    onRevealed,
    shown: {
      manifest: productOf(collection, state.shown.slug),
      life,
      outcome: state.shown.outcome,
      onSettled,
      onStageFailed,
    },
    preload,
  }
}

// The sequence only ever shows a product the route resolved against this
// collection, so a miss is an internal error.
function productOf(collection: ProductCollection, slug: string): Product {
  const product = collection.bySlug(slug)
  if (product === undefined) {
    throw new Error(
      `internal error: the switch shows '${slug}', which the collection does not hold`,
    )
  }
  return product
}
