// The site's own words: everything on screen that is not product copy.
// Product words live in the manifests under src/products/; these are the
// words of the frame around them, defined once for every layer that shows
// them. Labels are written in normal case: CSS uppercases eyebrows and
// labels, so screen readers read words instead of spelling out letters.

export const siteCopy = {
  studioName: 'Rebel Art Studios',
  collectionName: 'Product Concepts',
  siteUrl: 'rebelartstudios.org',
  stageLabel: 'Interactive 360 view',
  stageHint: 'Drag to rotate / Scroll to zoom',
  finishHeading: 'Choose your finish',
  defaultExplodeLabel: 'Exploded view',
  collectionErrorHeading: 'The collection failed to load',
  resetLabel: 'Reset',
  zoomInLabel: 'Zoom in',
  zoomOutLabel: 'Zoom out',
  closeLabel: 'Close',
  panelLabel: 'Product details',
} as const

export type SiteCopy = typeof siteCopy
