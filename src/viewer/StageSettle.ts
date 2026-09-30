import { TaskChain } from '@lib/async/taskChain'
import type { Camera, Scene } from 'three'
import type { FrameClock } from './FrameClock'

// The stage's serialized scene settle, one instance per mount like the frame
// clock and the model watch. Every post-mount scene mutation goes through
// it: a settle compiles the current scene with the current camera, presents
// a frame, and resolves only when that frame is recorded. The stage's
// settled promise is the chain's drain, so a mutation pushed while another
// settle compiles is included before the waiter moves on.

// The one renderer capability the settle uses, stated structurally: the
// stage renderer hands it over, and a test can stand in for it.
export type SettleResources = {
  readonly gl: {
    readonly compileAsync: (scene: Scene, camera: Camera) => Promise<unknown>
  }
  readonly scene: Scene
  readonly camera: Camera
  readonly invalidate: () => void
}

export class StageSettle {
  private readonly chain = new TaskChain()

  constructor(private readonly clock: FrameClock) {}

  // Settles the scene as it stands when the step runs. Resolves when every
  // settle pushed before it, this one, and any pushed while it compiled have
  // presented; rejects if this step's compile fails.
  settle(resources: SettleResources): Promise<void> {
    return this.chain.push(() => this.runSettleStep(resources))
  }

  // One settle step: compile, present, and verify. The compile walks the
  // scene cooperatively, yielding to frames between objects; a frame that
  // renders during that walk consumes the renderer's per-object update
  // state, and then the compile can resolve while the pipelines it was
  // building are still pending and the presented frame would skip the draws.
  // A frame count that moved during the compile marks such a walk, so the
  // step compiles again over a drained loop, where the renderer waits for
  // every pipeline it creates. The loop ends because frames render only on
  // invalidations, and the settles are the stage's only invalidations while
  // it loads.
  private async runSettleStep(resources: SettleResources): Promise<void> {
    const { gl, scene, camera, invalidate } = resources
    let fromFrame = this.clock.renderedFrames
    for (;;) {
      await gl.compileAsync(scene, camera)
      invalidate()
      await this.clock.onceFrame()
      const presented = this.clock.renderedFrames
      if (presented - fromFrame === 1) {
        return
      }
      fromFrame = presented
    }
  }
}
