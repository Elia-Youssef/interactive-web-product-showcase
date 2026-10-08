// The site's own words: everything on screen and in the head tags that is
// not product copy. Product words live in the manifests under src/products/;
// these are the words of the frame around them, defined once for every
// layer that shows them. Labels are written in normal case: CSS uppercases
// eyebrows and labels, so screen readers read words instead of spelling out
// letters.

export const siteCopy = {
  studioName: 'Rebel Art Studios',
  collectionName: 'Product Concepts',
  siteUrl: 'rebelartstudios.org',
  metaDescription:
    'Product Concepts by Rebel Art Studios: interactive 3D concept products. Rotate, zoom, switch finishes and pull each one apart in the browser.',
  stageLabel: 'Interactive 360 view',
  stageHint: 'Drag to rotate / Scroll to zoom',
  finishHeading: 'Choose your finish',
  defaultExplodeLabel: 'Exploded view',
  collectionErrorHeading: 'The collection failed to load',
  notFoundHeading: 'Not found',
  notFoundLine: 'That product does not exist in this collection.',
  notFoundLink: 'Open the collection',
  resetLabel: 'Reset',
  zoomInLabel: 'Zoom in',
  zoomOutLabel: 'Zoom out',
  closeLabel: 'Close',
  previousLabel: 'Previous',
  nextLabel: 'Next',
  indexLabel: 'Collection',
  openIndexLabel: 'Open the collection index',
  closeIndexLabel: 'Close the index',
  panelLabel: 'Product details',
  credit: 'Elia Youssef, Technical Lead, Rebel Art Studios',
} as const

export type SiteCopy = typeof siteCopy
