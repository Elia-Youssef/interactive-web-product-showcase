import type { CardMetrics } from './cardPlacement'
import type { MarkerExtent } from './markerBox'
import { parseCardDockPolicy, type CardDockPolicy } from './cardPresentation'

// The card layout as the stylesheets declare it, read from computed custom
// properties, so no length and no breakpoint is written twice: the dock
// policy is the token the breakpoints switch (the phone's sheet docks every
// card), and the metrics are the marker hit size, the card offset, the
// global focus ring's width and the marker's own ring offset. The marker
// declares its ring offset from that one token (it sets the global recipe's
// --focus-ring-offset from it), so the ring reaches the token plus the ring
// width outside the hit box, whatever the token says.

export const cardLayoutProperties = {
  dockPolicy: '--hotspot-card-dock',
  markerHit: '--size-hotspot-hit',
  cardOffset: '--offset-hotspot-card',
  focusWidth: '--focus-width',
  markerRingOffset: '--offset-hotspot-focus-ring',
} as const

export type CardLayout = {
  readonly policy: CardDockPolicy
  readonly metrics: CardMetrics
}

// The part of a computed style the reader touches: a real
// CSSStyleDeclaration satisfies it, and so does a test stand-in.
export type CustomPropertyRead = {
  getPropertyValue(property: string): string
}

export function readCardLayout(style: CustomPropertyRead): CardLayout {
  return {
    policy: parseCardDockPolicy(style.getPropertyValue(cardLayoutProperties.dockPolicy).trim()),
    metrics: {
      ...readMarkerExtent(style),
      cardOffsetPx: pxOf(style, cardLayoutProperties.cardOffset),
    },
  }
}

// The marker's own box as the stylesheets declare it: the hit size and the
// focus ring's reach outside it. The one reader of these tokens, for the
// card that keeps clear of every marker's box and for the visibility rule
// that shows a marker only while its box fits the stage.
export function readMarkerExtent(style: CustomPropertyRead): MarkerExtent {
  return {
    markerHitPx: pxOf(style, cardLayoutProperties.markerHit),
    focusOutsetPx:
      pxOf(style, cardLayoutProperties.focusWidth) +
      pxOf(style, cardLayoutProperties.markerRingOffset),
  }
}

// A computed custom property that must be a plain px length: the tokens
// resolve their var() references at computed-value time, so anything else
// is a token that changed shape, and it fails loudly with its name.
function pxOf(style: CustomPropertyRead, property: string): number {
  const value = style.getPropertyValue(property).trim()
  const parsed = /^(\d*\.?\d+)px$/.exec(value)
  if (parsed === null || parsed[1] === undefined) {
    throw new Error(`${property} must compute to a px length, but computes to '${value}'`)
  }
  return Number(parsed[1])
}
