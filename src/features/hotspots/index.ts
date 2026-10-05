// Public API of the hotspots feature: the two sides a composition mounts to
// give a product its markers. ProductHotspots extends the loaded product on
// the stage and writes the placements; HotspotMarkers renders the markers
// into the stage overlay and takes the presses. Both mount as children of
// the same composition, so a marker has a placement and a placement a
// marker.

export { ProductHotspots } from './ProductHotspots'
export { HotspotMarkers } from './HotspotMarkers'
export { CARD_OVERLAY_KEY, overlayKey } from './hotspotKeys'
