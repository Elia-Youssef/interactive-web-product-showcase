import { frameRecordCapacity, frameStats } from '@lib/renderer/frameStats'
import type { FrameStats } from '@lib/renderer/frameStats'
import { FrameRing } from '@lib/renderer/frameRing'
import { FrameWaiters } from './FrameWaiters'
import { StageRetiredError } from './StageRetiredError'

// Per-mount frame bookkeeping for one stage instance. The stage's present
// records into it per presented frame (allocating nothing), the automation
// hook reads it on access, and the HUD samples it at display cadence. The
// stage creates one instance per mount, so a remounted stage counts from
// zero; there is no module-level singleton.
export class FrameClock {
  private readonly ring = new FrameRing(frameRecordCapacity)
  private rendered = 0
  private readonly lives = new Set<FrameWaiters>()
  private failure: StageRetiredError | null = null
  private readonly waiters = this.createFrameLife()

  recordFrame(atMs: number, tickMs: number): void {
    if (this.failure !== null) {
      return
    }
    this.rendered += 1
    this.ring.push(atMs, tickMs)
    for (const life of this.lives) {
      life.recordFrame()
    }
  }

  get renderedFrames(): number {
    return this.rendered
  }

  // Resolves on the next recorded frame after the call. The registration is
  // synchronous, so a frame the caller has just scheduled cannot slip past
  // the wait.
  onceFrame(): Promise<void> {
    return this.waiters.onceFrame()
  }

  // A canvas's frame supply, separate from the stage's running counters.
  // Retiring one canvas ends only its waiters; its replacement gets a new
  // lifetime. Disposing the stage clock ends every remaining lifetime.
  createFrameLife(): FrameWaiters {
    // Only pending lives are retained, so an abandoned render (including
    // StrictMode's unused initializer) leaves nothing on the clock.
    const life: FrameWaiters = new FrameWaiters({
      failure: () => this.failure,
      pending: () => this.lives.add(life),
      drained: () => this.lives.delete(life),
    })
    return life
  }

  readonly retire = (): void => this.end(new StageRetiredError('retired'))
  readonly dispose = (): void => this.end(new StageRetiredError('disposed'))

  private end(reason: StageRetiredError): void {
    if (this.failure !== null) {
      return
    }
    this.failure = reason
    for (const life of this.lives) {
      life.end(reason)
    }
  }

  stats(nowMs: number): FrameStats {
    return frameStats(this.ring.records(), nowMs)
  }
}
