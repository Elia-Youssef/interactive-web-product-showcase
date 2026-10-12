import { Box3 } from 'three/webgpu'
import type { Group, Object3D } from 'three/webgpu'
import { describe, expect, it, vi } from 'vitest'
import { overlayKey } from '@lib/hotspots/hotspotKeys'
import type { ProductHotspot } from '@viewer/rig/productRig'
import {
  cameraLookingDownZ,
  crowdFixture,
  CROWD_PARTS,
  passesOf,
  writesOf,
} from './placer.fixtures'
import type { PlacerWrites } from './placer.fixtures'

// The placer's pass-level contracts: the anchor counts it faces, the shared
// part bounds it measures per pose, and the publication rule its outputs
// follow. The crowd fixture is four parts with three anchors each, twelve
// hotspots in all, none of them a shipped product's.

describe('HotspotPlacer passes', () => {
  describe('anchor counts', () => {
    it('places no hotspot and publishes nothing at all', () => {
      const camera = cameraLookingDownZ(5)
      const passes = passesOf([], [], camera, 2)

      for (const pass of passes) {
        expect(pass.placements.size).toBe(0)
        expect(pass.boxes.size).toBe(0)
      }
    })

    it('places one hotspot exactly as it places it alone in the crowd', () => {
      const { hotspots, occluders, camera } = crowdFixture()
      const [crowd] = passesOf(hotspots, occluders, camera, 1)
      if (crowd === undefined) {
        throw new Error('the harness must record the pass')
      }

      for (const hotspot of hotspots) {
        const alone = writesOf([hotspot], occluders, camera)
        const key = overlayKey(hotspot.id)
        expect(crowd.placements.get(key)).toEqual(alone.placements.get(key))
        expect(crowd.boxes.get(key)).toEqual(alone.boxes.get(key))
      }
    })
  })

  describe('shared part bounds', () => {
    it('measures each distinct part once per pass, however many hotspots ride it', () => {
      const { hotspots, occluders, camera } = crowdFixture()
      const measure = vi.spyOn(Box3.prototype, 'setFromObject')
      try {
        const passCount = 3
        passesOf(hotspots, occluders, camera, passCount)
        expect(measure).toHaveBeenCalledTimes(CROWD_PARTS * passCount)
      } finally {
        measure.mockRestore()
      }
    })

    it('measures again on the pass after the pose moved', () => {
      const { hotspots, occluders, camera, parts } = crowdFixture()
      const measure = vi.spyOn(Box3.prototype, 'setFromObject')
      try {
        const passes = passesOf(hotspots, occluders, camera, 2, () => moveUp(parts[0], 0.05))
        expect(measure).toHaveBeenCalledTimes(CROWD_PARTS * 2)
        const moved = hotspots.filter((hotspot) => hotspot.part === parts[0])
        for (const hotspot of moved) {
          expect(passes[1]?.boxes.get(overlayKey(hotspot.id))).toBeDefined()
        }
      } finally {
        measure.mockRestore()
      }
    })
  })

  describe('publication', () => {
    it('publishes each anchor once and then nothing while nothing moves', () => {
      const { hotspots, occluders, camera } = crowdFixture()
      const passes = passesOf(hotspots, occluders, camera, 3)
      const [first, ...rest] = passes
      if (first === undefined) {
        throw new Error('the harness must record the passes')
      }

      expect(first.placements.size).toBe(hotspots.length)
      expect(first.boxes.size).toBe(hotspots.length)
      for (const pass of rest) {
        expect(pass.placements.size).toBe(0)
        expect(pass.boxes.size).toBe(0)
      }
    })

    it('publishes a fresh record only for the anchors whose values changed', () => {
      const { hotspots, occluders, camera, parts } = crowdFixture()
      const passes = passesOf(hotspots, occluders, camera, 2, () => moveUp(parts[2], 0.2))
      const [first, second] = passes
      if (first === undefined || second === undefined) {
        throw new Error('the harness must record both passes')
      }
      const movedIds = new Set(keysOfPart(hotspots, parts[2]))
      for (const hotspot of hotspots) {
        const key = overlayKey(hotspot.id)
        if (movedIds.has(key)) {
          expect(second.placements.get(key)).toBeDefined()
          expect(second.placements.get(key)).not.toBe(first.placements.get(key))
          expect(second.boxes.get(key)).not.toBe(first.boxes.get(key))
        } else {
          expect(second.placements.has(key)).toBe(false)
          expect(second.boxes.has(key)).toBe(false)
        }
      }
    })

    it('writes hidden once on the transition and then nothing', () => {
      const { hotspots, occluders, camera, parts } = crowdFixture()
      // The part moves far enough that its anchors' keep-out boxes cross
      // the stage edge, which hides their markers.
      const passes = passesOf(hotspots, occluders, camera, 3, () => moveAside(parts[1]))
      const [first, second, third] = passes
      if (first === undefined || second === undefined || third === undefined) {
        throw new Error('the harness must record all passes')
      }
      const hiddenIds = new Set(keysOfPart(hotspots, parts[1]))
      for (const [key, placement] of second.placements) {
        expect(hiddenIds.has(key)).toBe(true)
        expect(placement).toEqual({ kind: 'hidden' })
      }
      expect(third.placements.size).toBe(0)
      // A hidden marker publishes no subject extent for its part.
      for (const key of hiddenIds) {
        expect(second.boxes.has(key)).toBe(false)
      }
    })

    it('hands two hotspots of one part distinct output records', () => {
      const { hotspots, occluders, camera } = crowdFixture()
      const [first] = passesOf(hotspots, occluders, camera, 1)
      if (first === undefined) {
        throw new Error('the harness must record the pass')
      }
      const sharedPart = hotspots[0]?.part
      const pair = hotspots.filter((hotspot) => hotspot.part === sharedPart)
      const a = boxRecordOf(first, pair[0])
      const b = boxRecordOf(first, pair[1])
      expect(a).not.toBe(b)
      expect(a).toEqual(b)
    })
  })
})

function moveUp(part: Group | undefined, meters: number): void {
  if (part === undefined) {
    return
  }
  part.position.y += meters
  part.updateMatrixWorld(true)
}

function moveAside(part: Group | undefined): void {
  if (part === undefined) {
    return
  }
  part.position.x = 4
  part.updateMatrixWorld(true)
}

function keysOfPart(hotspots: readonly ProductHotspot[], part: Object3D | undefined): string[] {
  return hotspots
    .filter((hotspot) => hotspot.part === part)
    .map((hotspot) => overlayKey(hotspot.id))
}

function boxRecordOf(pass: PlacerWrites, hotspot: { id: string } | undefined) {
  const key = hotspot === undefined ? '' : overlayKey(hotspot.id)
  return pass.boxes.get(key)
}
