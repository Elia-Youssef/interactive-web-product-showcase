// The words the app's one live region announces, derived from what changed
// between two snapshots of the page: a product change announces the new
// product's name, a finish change on the presented product announces the
// new finish, a card opened from a marker reads its title and bullets, the
// camera arriving home announces the home view, a step that reaches a
// zoom or tilt limit names the limit, and the loading readout's reveal
// announces the load once per wait. A page that only re-rendered
// announces nothing, and neither does an ordinary camera step: a turn the
// visitor cannot see tells a screen reader nothing, and the readouts carry
// the angle and the zoom as text for anyone who reads them.
// A product change announces the product alone, never both: the finish
// name it lands on is the state it arrives in, not a change the visitor
// made. Pure, so the component that holds the region stays render-only.

import { tiltDirectionAtLimit, type TiltLimit } from '../camera/orbitStep'
import type { HotspotOrigin } from '../hotspots/flow'
import { zoomDirectionAtLimit, type ZoomLimit } from '../camera/zoom'
import { siteCopy } from './site'

// The limits the camera's move ends at, while a view is presented.
export type CameraLimits = {
  readonly zoom: ZoomLimit | null
  readonly tilt: TiltLimit | null
}

// The open hotspot card: its hotspot, where it was opened from, and the
// words a marker-opened card reads.
export type AnnouncedCard = {
  readonly hotspot: string
  readonly origin: HotspotOrigin
  readonly words: string
}

// What the page presented the last time the region spoke, or null before
// the first snapshot: a page that mounts announces nothing.
export type AnnouncedState = {
  // The slug of the presented product.
  readonly product: string
  // The product's display name, the words a product change announces.
  readonly productName: string
  // The active finish's label, the words a finish change announces.
  readonly finishLabel: string
  // The limits the camera sits at, or null while no view is presented: a
  // view that is presented at a limit reached nothing, so only a change
  // between two presented snapshots announces.
  readonly cameraLimits: CameraLimits | null
  // The sequence of the newest camera request that settled at the home
  // view, or null while the newest settled request is any other: each new
  // arrival home announces once.
  readonly homeArrival: number | null
  // The open hotspot card of the presented product, or null while none is.
  readonly card: AnnouncedCard | null
  // How many times the loading readout has revealed so far on this page:
  // each new count is one reveal the region owes its word for, once per
  // wait, and the count survives the wait so a later wait's reveal still
  // reads as a change.
  readonly loadingReveal: number
  // Whether a loading wait is running: the wait ending clears the loading
  // word the region may hold, with no completion word to replace it.
  readonly loadingWait: boolean
}

// Labels belong to site copy; the direction that exhausts a limit belongs
// to the camera. Compose the words so neither fact is repeated by position.
const tiltControlLabel = { up: siteCopy.tiltUpLabel, down: siteCopy.tiltDownLabel }
const zoomControlLabel = { 1: siteCopy.zoomInLabel, [-1]: siteCopy.zoomOutLabel }

function limitAnnouncement(label: string): string {
  return `${label} limit`
}

export const announcementCopy = {
  homeView: 'Home view',
  loading: siteCopy.loadingLabel,
  zoomLimit: {
    closest: limitAnnouncement(zoomControlLabel[zoomDirectionAtLimit.closest]),
    farthest: limitAnnouncement(zoomControlLabel[zoomDirectionAtLimit.farthest]),
  },
  tiltLimit: {
    top: limitAnnouncement(tiltControlLabel[tiltDirectionAtLimit.top]),
    bottom: limitAnnouncement(tiltControlLabel[tiltDirectionAtLimit.bottom]),
  },
} as const satisfies {
  readonly homeView: string
  readonly loading: string
  readonly zoomLimit: Readonly<Record<ZoomLimit, string>>
  readonly tiltLimit: Readonly<Record<TiltLimit, string>>
}

// The announcement the change from previous to current owes, or null when
// it owes none. The region's current words come along, because the one
// announcement that depends on them is the clear: a wait that ended takes
// the loading word out of the region, and nothing else, so every
// announcement a diff owes wins over the clear.
export function nextAnnouncement(
  previous: AnnouncedState | null,
  current: AnnouncedState,
  regionWords: string,
): string | null {
  if (previous === null) {
    return null
  }
  if (current.product !== previous.product) {
    return current.productName
  }
  if (current.finishLabel !== previous.finishLabel) {
    return current.finishLabel
  }
  if (openedFromMarker(previous.card, current.card)) {
    return current.card.words
  }
  if (current.loadingReveal !== previous.loadingReveal) {
    return announcementCopy.loading
  }
  if (current.homeArrival !== null && current.homeArrival !== previous.homeArrival) {
    return announcementCopy.homeView
  }
  const limit = reachedLimit(previous.cameraLimits, current.cameraLimits)
  if (limit !== null) {
    return limit
  }
  if (previous.loadingWait && !current.loadingWait && regionWords === announcementCopy.loading) {
    return ''
  }
  return null
}

// The words a card opened from a marker reads, once: its title, then its
// bullets, each a sentence of its own.
export function cardWords(title: string, bullets: readonly string[]): string {
  return [title, ...bullets].join('. ')
}

// Whether the current card was opened from a marker since the previous
// snapshot: a new marker card, or a list card a marker press moved to the
// stage. A card opened from the list sits under the button that opened it,
// where focus is, so it reads itself and announces nothing.
function openedFromMarker(
  previous: AnnouncedCard | null,
  current: AnnouncedCard | null,
): current is AnnouncedCard {
  if (current === null || current.origin !== 'marker') {
    return false
  }
  return previous === null || previous.hotspot !== current.hotspot || previous.origin !== 'marker'
}

// The limit a step reached between two presented snapshots: one the camera
// sits at now and did not before. The tilt speaks first when one step
// reached both, which a merged frame of keys can do.
function reachedLimit(previous: CameraLimits | null, current: CameraLimits | null): string | null {
  if (previous === null || current === null) {
    return null
  }
  if (current.tilt !== null && current.tilt !== previous.tilt) {
    return announcementCopy.tiltLimit[current.tilt]
  }
  if (current.zoom !== null && current.zoom !== previous.zoom) {
    return announcementCopy.zoomLimit[current.zoom]
  }
  return null
}
