// The overlay key of one hotspot marker: the feature's own namespace inside
// the stage overlay channel, which knows keys and placements, never
// hotspots. Both sides of the feature derive the key through this one
// function, so the writer and the mounted element cannot drift apart.
export function overlayKey(hotspotId: string): string {
  return `hotspot:${hotspotId}`
}
