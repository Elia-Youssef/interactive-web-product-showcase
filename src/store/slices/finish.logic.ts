// The finish selection as a small state machine, one event at a time. Every
// event names the product it belongs to, because one store is shared by
// every product: an unnamed selection reaches the next product and either
// crashes its first render or mislabels its default. The panel feeds the
// offer from the current product's manifest.

// The variants the current product offers, at least one because the manifest
// schema guarantees it, in manifest order with the default first.
export type FinishVariants = readonly [string, ...string[]]

export type FinishOffer = {
  // The slug of the one product this offer belongs to. The selection
  // travels with its product and is readable only for it.
  readonly product: string
  readonly variants: FinishVariants
  // The variant the user sees as active right now.
  readonly selected: string
}

export type IdleFinishStatus = { kind: 'idle' }

export type OfferedFinishStatus = {
  kind: 'offered'
  offer: FinishOffer
}

export type FinishStatus = IdleFinishStatus | OfferedFinishStatus

export type FinishEvent =
  | { kind: 'offered'; product: string; variants: readonly string[] }
  | { kind: 'selected'; product: string; variant: string }
  | { kind: 'reset'; product: string }

export const initialFinishStatus: FinishStatus = { kind: 'idle' }

// Pure transition from (status, event) to the next status. Selecting before
// an offer, a variant the offer does not carry, or acting for a product that
// is not the one on offer is a programming error and throws. An offer that
// is new for its product resets the selection to that product's default,
// its first finish, because the offer names one product's finishes.
export function applyFinishEvent(status: FinishStatus, event: FinishEvent): FinishStatus {
  switch (event.kind) {
    case 'offered':
      return offer(status, event.product, event.variants)
    case 'selected':
      return selectVariant(status, event.product, event.variant)
    case 'reset':
      return resetVariant(status, event.product)
  }
}

// The same product with the same variants is the same offer and returns the
// same status, so a remount, a StrictMode double effect or a layout move
// keeps the user's selection. Any other offer is new for its product and
// starts at that product's default.
function offer(status: FinishStatus, product: string, variants: readonly string[]): FinishStatus {
  if (
    status.kind === 'offered' &&
    status.offer.product === product &&
    sameVariants(status.offer.variants, variants)
  ) {
    return status
  }
  return { kind: 'offered', offer: offerOf(product, variants) }
}

// Element by element, not by identity: the panel rebuilds the variant array
// on every offer, so only the names and their order can say same.
function sameVariants(a: FinishVariants, b: readonly string[]): boolean {
  return a.length === b.length && a.every((variant, index) => variant === b[index])
}

function offerOf(product: string, variants: readonly string[]): FinishOffer {
  const [first, ...rest] = variants
  if (first === undefined) {
    throw new Error(`a finish offer for the product '${product}' needs at least one variant`)
  }
  return { product, variants: [first, ...rest], selected: first }
}

function selectVariant(status: FinishStatus, product: string, variant: string): FinishStatus {
  if (status.kind === 'idle') {
    throw new Error(`cannot select the finish '${variant}' before a product offers its finishes`)
  }
  onOfferedProduct(status.offer, product)
  if (!status.offer.variants.includes(variant)) {
    throw new Error(`the offered finishes do not include the variant '${variant}'`)
  }
  return withSelected(status, variant)
}

function resetVariant(status: FinishStatus, product: string): FinishStatus {
  if (status.kind === 'idle') {
    return status
  }
  onOfferedProduct(status.offer, product)
  return withSelected(status, status.offer.variants[0])
}

// The product guard of every action on an offered status, so a stale panel
// instance cannot move another product's selection.
function onOfferedProduct(offer: FinishOffer, product: string): void {
  if (offer.product !== product) {
    throw new Error(
      `the product '${product}' is not on offer; the offer belongs to '${offer.product}'`,
    )
  }
}

// The same selection returns the same status object, so the store keeps its
// identity and subscribers see no change.
function withSelected(status: OfferedFinishStatus, selected: string): FinishStatus {
  if (status.offer.selected === selected) {
    return status
  }
  return { kind: 'offered', offer: { ...status.offer, selected } }
}
