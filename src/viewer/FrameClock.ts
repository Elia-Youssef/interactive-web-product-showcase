import { frameRecordCapacity, frameStats } from '@lib/renderer/frameStats'
import type { FrameStats } from '@lib/renderer/frameStats'
import { FrameRing } from '@lib/renderer/frameRing'

// Per-mount frame bookkeeping for one stage instance. The stage's present
// records into it per presented frame (allocating nothing), the automation
// hook reads it on access, and the HUD samples it at display cadence. The
// stage creates one instance per mount, so a remounted stage counts from
// zero; there is no module-level singleton.
export class FrameClock {
  private readonly ring = new FrameRing(frameRecordCapacity)
  private rendered = 0
  // Waiters for the next recorded frame. Settle steps await one frame, so
  // the list holds at most a handful of entries at a time.
  private frameWaiters: (() => void)[] = []

  recordFrame(atMs: number, tickMs: number): void {
    this.rendered += 1
    this.ring.push(atMs, tickMs)
    for (const waiter of this.frameWaiters.splice(0)) {
      waiter()
    }
  }

  get renderedFrames(): number {
    return this.rendered
  }

  // Resolves on the next recorded frame after the call. The registration is
  // synchronous, so a frame the caller has just scheduled cannot slip past
  // the wait.
  onceFrame(): Promise<void> {
    return new Promise<void>((resolve) => {
      this.frameWaiters.push(resolve)
    })
  }

  stats(nowMs: number): FrameStats {
    return frameStats(this.ring.records(), nowMs)
  }
}
