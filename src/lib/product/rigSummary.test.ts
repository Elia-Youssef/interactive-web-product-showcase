import { describe, expect, it } from 'vitest'
import { closeUpHotspotIds } from './rigSummary'
import type { ProductRigSummary } from './rigSummary'

function rigWith(cameras: readonly string[]): ProductRigSummary {
  return {
    parts: ['PART_body'],
    hotspots: [
      { id: 'driver', part: 'PART_body' },
      { id: 'knob', part: 'PART_top' },
    ],
    cameras,
    clip: { name: 'Explode', durationSeconds: 1 },
    variants: [],
  }
}

describe('closeUpHotspotIds', () => {
  it('maps the per-hotspot camera names to their hotspot ids', () => {
    expect(closeUpHotspotIds(rigWith(['CAM_home', 'CAM_driver']))).toEqual(new Set(['driver']))
  })

  it('leaves out the home camera, which no hotspot owns', () => {
    expect(closeUpHotspotIds(rigWith(['CAM_home']))).toEqual(new Set())
  })

  it('collects every hotspot close-up the rig carries', () => {
    expect(closeUpHotspotIds(rigWith(['CAM_home', 'CAM_driver', 'CAM_knob']))).toEqual(
      new Set(['driver', 'knob']),
    )
  })
})
