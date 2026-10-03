import type { Product } from '../../src/lib/product'
import type { AuthoredView, ProductCameraFacts } from './productCamera'

// The subjects of the hotspot flow proof, selected from the product set:
// per product, its close-up hotspots and its plain hotspots, each list
// possibly empty, because no product is required to carry both kinds, and
// its hotspot switches by transition kind, one pair per kind the product
// offers. The selection is pure: the products and their view facts in, the
// subjects out. The set-level guards fail at collection when the whole
// product set carries no close-up hotspot, no plain hotspot, or no switch
// whose camera moves, naming what is missing, so a proof never disappears
// silently with the products it was written to drive.

// One manifest hotspot as the subjects and the switch pairs carry it.
export type FlowHotspot = Product['hotspots'][number]

// A subject hotspot with its authored close-up view.
export type FlowCloseUp = FlowHotspot & {
  readonly view: AuthoredView
}

// The transition kinds of a switch, named by the two hotspots' kinds in
// switch order. Between two plain hotspots the camera never moves, so that
// pair proves nothing and is no subject.
export type SwitchKind = 'close-up-to-plain' | 'close-up-to-close-up' | 'plain-to-close-up'

// One switch of a product's hotspots, chosen by the pair's kinds and not by
// manifest position: which transition a set proves must not depend on where
// its hotspots sit in a manifest.
export type SwitchPair = {
  readonly kind: SwitchKind
  readonly from: FlowHotspot
  readonly to: FlowHotspot
}

// The flow proof's subjects of one product.
export type FlowSubject = {
  readonly product: Product
  readonly viewFacts: ProductCameraFacts
  // The product's hotspots with an authored close-up, in manifest order.
  readonly closeUps: readonly FlowCloseUp[]
  // The product's hotspots without one, in manifest order.
  readonly plains: readonly FlowHotspot[]
  // One switch pair per transition kind the product offers.
  readonly switches: readonly SwitchPair[]
  // The authored close-up view of one of the product's hotspots by id, or
  // null when that hotspot has none. An id outside the product fails
  // loudly, so a spec driving a missing hotspot stops instead of guessing.
  readonly viewOf: (hotspotId: string) => AuthoredView | null
}

// One subject hotspot as the selection sorts it: the view is null exactly
// for a plain hotspot.
type SortedHotspot = FlowHotspot & { readonly view: AuthoredView | null }

// Selects the flow proof's subjects over the whole product set. Fails at
// collection, naming what is missing, when the set carries no hotspot of
// one kind or no camera-moving switch: the close-up tests, the plain tests
// and the switch tests each need at least one product that has what they
// drive, wherever in the set it sits.
export function selectFlowSubjects(
  products: readonly Product[],
  viewFactsBySlug: ReadonlyMap<string, ProductCameraFacts>,
): readonly FlowSubject[] {
  const subjects = products.map((product) => subjectOf(product, viewFactsBySlug))
  if (!subjects.some((subject) => subject.closeUps.length > 0)) {
    throw new Error('the product set carries no close-up hotspot for the flow proof')
  }
  if (!subjects.some((subject) => subject.plains.length > 0)) {
    throw new Error('the product set carries no plain hotspot for the flow proof')
  }
  if (!subjects.some((subject) => subject.switches.length > 0)) {
    throw new Error(
      'the product set carries no hotspot switch that moves the camera for the flow proof',
    )
  }
  return subjects
}

function subjectOf(
  product: Product,
  viewFactsBySlug: ReadonlyMap<string, ProductCameraFacts>,
): FlowSubject {
  const viewFacts = viewFactsBySlug.get(product.slug)
  if (viewFacts === undefined) {
    throw new Error(`no view facts for ${product.slug}`)
  }
  const sorted: SortedHotspot[] = product.hotspots.map((hotspot) => ({
    ...hotspot,
    view: viewFacts.closeUps.get(hotspot.id) ?? null,
  }))
  const closeUps = sorted.filter(hasView)
  const plains = sorted.filter((hotspot) => hotspot.view === null)
  const viewsById = new Map(sorted.map((hotspot) => [hotspot.id, hotspot.view]))
  return {
    product,
    viewFacts,
    closeUps,
    plains,
    switches: switchPairsOf(closeUps, plains),
    viewOf: (hotspotId) => {
      const view = viewsById.get(hotspotId)
      if (view === undefined) {
        throw new Error(`no hotspot '${hotspotId}' in ${product.slug}`)
      }
      return view
    },
  }
}

// One pair per transition kind the product offers, its endpoints picked by
// kind: the first hotspot of each kind stands for its kind, so the proven
// transition is the same whichever manifest order carries it.
function switchPairsOf(
  closeUps: readonly FlowCloseUp[],
  plains: readonly FlowHotspot[],
): readonly SwitchPair[] {
  const closeUp = closeUps[0]
  const plain = plains[0]
  const secondCloseUp = closeUps[1]
  const switches: SwitchPair[] = []
  if (closeUp !== undefined && plain !== undefined) {
    switches.push(
      { kind: 'close-up-to-plain', from: closeUp, to: plain },
      { kind: 'plain-to-close-up', from: plain, to: closeUp },
    )
  }
  if (closeUp !== undefined && secondCloseUp !== undefined) {
    switches.push({ kind: 'close-up-to-close-up', from: closeUp, to: secondCloseUp })
  }
  return switches
}

function hasView(hotspot: SortedHotspot): hotspot is FlowCloseUp {
  return hotspot.view !== null
}
