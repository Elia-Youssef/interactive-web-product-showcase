import { useCallback, useEffect, useMemo } from 'react'
import { Vector3 } from 'three'
import type { ProductHotspot } from '@viewer/rig/productRig'
import { useLoadedProduct } from '@viewer/product/loadedProduct'
import { STAGE_PRESENT_PRIORITY, usePresentedFrame, useStageFrame } from '@viewer/stageFrameContext'

// The place of the capture among a frame's steps: after every step the
// stage and its content run (the camera controls below zero, the content's
// own steps at zero, the frame path's default), and before the present:
// halfway between the two is strictly after the one and before the other.
const CONTENT_STEP_PRIORITY = 0
const CAPTURE_PRIORITY = (CONTENT_STEP_PRIORITY + STAGE_PRESENT_PRIORITY) / 2

// The dev-only read of the anchors as the last presented frame drew them,
// for the proofs that hold the markers to what the canvas shows. The
// capture runs as the frame's last step before the present, so it reads
// the pose the present draws, whatever step wrote it; the post-present
// phase then commits it, only after a frame that presented. A read through
// the window getter answers the committed pose, which a proof compares with
// the live anchors: a pose written after the present is live but was never
// drawn. Dev-only, like the harness that mounts it.
export function PresentedAnchorsProbe() {
  const loaded = useLoadedProduct()
  const record = useMemo(() => createAnchorRecord(loaded.rig.hotspots), [loaded])

  useStageFrame('content', () => record.capture(), CAPTURE_PRIORITY)
  const commit = useCallback(() => record.commit(), [record])
  usePresentedFrame('content', commit)

  useEffect(() => {
    window.__harnessPresentedAnchors = record.read
    return () => {
      if (window.__harnessPresentedAnchors === record.read) {
        delete window.__harnessPresentedAnchors
      }
    }
  }, [record])

  return null
}

// One anchor as the last presented frame drew it, in world space.
export type HarnessPresentedAnchor = {
  readonly id: string
  readonly position: { readonly x: number; readonly y: number; readonly z: number }
}

type AnchorRecord = {
  readonly capture: () => void
  readonly commit: () => void
  readonly read: () => readonly HarnessPresentedAnchor[] | null
}

// The pending capture of the frame under way and the committed one of the
// last presented frame, one vector per hotspot each, allocated once per
// load, so the frame path allocates nothing.
function createAnchorRecord(hotspots: readonly ProductHotspot[]): AnchorRecord {
  const pending = hotspots.map(() => new Vector3())
  const presented = hotspots.map(() => new Vector3())
  let committed = false
  return {
    capture: () => {
      hotspots.forEach((hotspot, index) => {
        const target = pending[index]
        if (target !== undefined) {
          hotspot.node.getWorldPosition(target)
        }
      })
    },
    commit: () => {
      pending.forEach((source, index) => presented[index]?.copy(source))
      committed = true
    },
    read: () => {
      if (!committed) {
        return null
      }
      return hotspots.map((hotspot, index) => {
        const position = presented[index]
        if (position === undefined) {
          throw new Error(`the presented anchor record lost ${hotspot.id}`)
        }
        return { id: hotspot.id, position: { x: position.x, y: position.y, z: position.z } }
      })
    },
  }
}

declare global {
  interface Window {
    __harnessPresentedAnchors?: () => readonly HarnessPresentedAnchor[] | null
  }
}
