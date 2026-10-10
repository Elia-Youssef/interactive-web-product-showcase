import { selectHotspotProducts } from './hotspotProducts'
import type { Product } from '../../src/lib/product'
import type { AuthoredView, ProductCameraFacts } from './productCamera'
import type { MarkerViews } from './productMarkerViews'

// The subjects of the hotspot flow proof, selected from the product set:
// per product, its close-up hotspots and its plain hotspots, each list
// possibly empty, because no product is required to carry both kinds, and
// its hotspot switches by transition kind, one pair per kind the product
// offers. A switch is pressed on the target's marker while the first
// hotspot's view is shown, so a pair counts only when that view shows the
// target's marker: no product is required to show every marker in every
// close-up. The selection is pure: the products, their view facts and the
// markers each view shows in, the subjects out. The set-level guards fail at collection when the whole
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
  markerViewsBySlug: ReadonlyMap<string, MarkerViews>,
): readonly FlowSubject[] {
  const subjects = selectHotspotProducts(products).map((product) =>
    subjectOf(product, viewFactsBySlug, markerViewsBySlug),
  )
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
  markerViewsBySlug: ReadonlyMap<string, MarkerViews>,
): FlowSubject {
  const viewFacts = viewFactsBySlug.get(product.slug)
  if (viewFacts === undefined) {
    throw new Error(`no view facts for ${product.slug}`)
  }
  const markerViews = markerViewsBySlug.get(product.slug)
  if (markerViews === undefined) {
    throw new Error(`no marker views for ${product.slug}`)
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
    switches: switchPairsOf(closeUps, plains, markerViews),
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
// kind: the first pair of each kind, in manifest order, whose target marker
// the first hotspot's view shows (its close-up, or home for a plain
// hotspot, whose opening leaves the camera there), so the proven transition
// is the same whichever manifest order carries it.
function switchPairsOf(
  closeUps: readonly FlowCloseUp[],
  plains: readonly FlowHotspot[],
  markerViews: MarkerViews,
): readonly SwitchPair[] {
  return [
    ...firstShownPair('close-up-to-plain', closeUps, plains, (from) =>
      closeUpViewOf(markerViews, from),
    ),
    ...firstShownPair('plain-to-close-up', plains, closeUps, () => markerViews.home),
    ...firstShownPair('close-up-to-close-up', closeUps, closeUps, (from) =>
      closeUpViewOf(markerViews, from),
    ),
  ]
}

// The first pair of one kind whose target's marker shows in the first
// hotspot's view, or none.
function firstShownPair(
  kind: SwitchKind,
  froms: readonly FlowHotspot[],
  tos: readonly FlowHotspot[],
  shownFrom: (from: FlowHotspot) => ReadonlySet<string>,
): readonly SwitchPair[] {
  for (const from of froms) {
    const shown = shownFrom(from)
    const to = tos.find((candidate) => candidate.id !== from.id && shown.has(candidate.id))
    if (to !== undefined) {
      return [{ kind, from, to }]
    }
  }
  return []
}

function closeUpViewOf(markerViews: MarkerViews, hotspot: FlowHotspot): ReadonlySet<string> {
  const shown = markerViews.closeUps.get(hotspot.id)
  if (shown === undefined) {
    throw new Error(`no marker view for the close-up of ${hotspot.id}`)
  }
  return shown
}

function hasView(hotspot: SortedHotspot): hotspot is FlowCloseUp {
  return hotspot.view !== null
}
