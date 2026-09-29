import { frameRecordCapacity, frameStats } from '@lib/renderer/frameStats'
import type { FrameStats } from '@lib/renderer/frameStats'
import { FrameRing } from '@lib/renderer/frameRing'

// Per-mount frame bookkeeping for one stage instance. The frame observer
// records into it per frame (allocating nothing), the automation hook reads
// it on access, and the HUD samples it at display cadence. The stage creates
// one instance per mount, so a remounted stage counts from zero; there is no
// module-level singleton.
export class FrameClock {
  private readonly ring = new FrameRing(frameRecordCapacity)
  private rendered = 0

  recordFrame(atMs: number, tickMs: number): void {
    this.rendered += 1
    this.ring.push(atMs, tickMs)
  }

  get renderedFrames(): number {
    return this.rendered
  }

  stats(nowMs: number): FrameStats {
    return frameStats(this.ring.records(), nowMs)
  }
}
