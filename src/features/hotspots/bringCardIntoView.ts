// A card that renders in the panel, docked in the sheet or listed under
// its Highlights item, brings its top to the top of its scroller's visible
// band as it mounts, which is when it opens or, keyed by its hotspot, when
// the open hotspot changes. The top, not the nearest edge: a card taller
// than what is left of the band would otherwise arrive bottom-first and put
// its header out of view, where the close button cannot be reached. The
// scroller is whichever holds the card, the panel or the document, and the
// scroll follows its own scroll behavior, which the stylesheets make smooth
// only when reduced motion is off. A card that must keep what sits above it
// in view (a listed card's own list button) says so with a scroll margin.
export function bringCardIntoView(element: HTMLElement | null): void {
  element?.scrollIntoView({ block: 'start' })
}
