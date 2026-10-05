// The overlay key of one hotspot marker: the feature's own namespace inside
// the stage overlay channel, which knows keys and placements, never
// hotspots. Both sides of the feature derive the key through this one
// function, so the writer and the mounted element cannot drift apart.
export function overlayKey(hotspotId: string): string {
  return `hotspot:${hotspotId}`
}

// The overlay key of the open card's floating element. One card is open at
// a time, so the key is one constant; it sits outside the markers'
// `hotspot:` namespace, so no hotspot id can ever name it.
export const CARD_OVERLAY_KEY = 'hotspot-card'
