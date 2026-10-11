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
  stageHint: 'Drag or arrows rotate / Scroll or + - zoom',
  stageKeysDescription:
    'Arrow keys rotate and tilt, with Shift for a fine step. Plus and minus zoom. Home returns to the home view.',
  finishHeading: 'Choose your finish',
  defaultExplodeLabel: 'Exploded view',
  collectionErrorHeading: 'The collection failed to load',
  notFoundHeading: 'Not found',
  notFoundLine: 'That product does not exist in this collection.',
  notFoundLink: 'Open the collection',
  resetLabel: 'Reset',
  zoomInLabel: 'Zoom in',
  zoomOutLabel: 'Zoom out',
  rotateLeftLabel: 'Rotate left',
  rotateRightLabel: 'Rotate right',
  tiltUpLabel: 'Tilt up',
  tiltDownLabel: 'Tilt down',
  closeLabel: 'Close',
  previousLabel: 'Previous',
  nextLabel: 'Next',
  indexLabel: 'Collection',
  openIndexLabel: 'Open the collection index',
  closeIndexLabel: 'Close the collection index',
  panelLabel: 'Product details',
  highlightsHeading: 'Highlights',
  credit: 'Elia Youssef, Technical Lead, Rebel Art Studios',

  // The loading readout's own words: the one label it shows, which CSS
  // uppercases on the stage, and the one word its reveal announces.
  loadingLabel: 'Loading',
} as const

export type SiteCopy = typeof siteCopy
