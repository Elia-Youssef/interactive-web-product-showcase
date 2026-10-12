import { isMarkerVisible } from './visibility'

// Real visibility inputs for every way a projected marker loses placement.
export const markerLossCases = [
  { reason: 'stage edge', x: 0, inFront: true, occluded: false, obstacles: [] },
  { reason: 'behind the camera', x: 125, inFront: false, occluded: false, obstacles: [] },
  {
    reason: 'chrome contact',
    x: 125,
    inFront: true,
    occluded: false,
    obstacles: [{ left: 125, top: 100, right: 200, bottom: 150 }],
  },
  { reason: 'part occlusion', x: 125, inFront: true, occluded: true, obstacles: [] },
].map((entry) => ({
  reason: entry.reason,
  marker: isMarkerVisible(
    { x: entry.x, y: 100, inFront: entry.inFront },
    { width: 250, height: 200 },
    { markerHitPx: 44, focusOutsetPx: 5 },
    entry.occluded,
    entry.obstacles,
  )
    ? { x: entry.x, y: 100 }
    : null,
}))
