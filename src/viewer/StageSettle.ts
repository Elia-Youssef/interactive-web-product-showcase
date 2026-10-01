import { TaskChain } from '@lib/async/taskChain'
import type { Camera, Scene } from 'three'
import type { FrameClock } from './FrameClock'

// The stage's serialized scene settle, one instance per mount like the frame
// clock and the model watch. Every post-mount scene mutation goes through
// it: a settle compiles the current scene with the current camera, presents
// the settled state twice, and resolves only when both frames are recorded.
// The stage's settled promise is the chain's drain, so a mutation pushed
// while another settle compiles is included before the waiter moves on.

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
  // presented twice; rejects if this step's compile fails.
  settle(resources: SettleResources): Promise<void> {
    return this.chain.push(() => this.runSettleStep(resources))
  }

  // One settle step: compile, then present the settled state twice.
  //
  // The presents follow the compile, never a frame before it, because the
  // compile's resolution is the renderer's own pipeline-readiness signal.
  // Its cooperative walk creates every pipeline the scene needs and awaits
  // each pipeline's completion before it moves to the next object (three,
  // Renderer.js compileAsync: getForRender with a promises array, then
  // Promise.all), and a frame that renders during the walk builds the
  // pipelines it reaches itself, synchronously: a frame-path pipeline is
  // created with no promises array, which completes within the call on both
  // backends (WebGPU device.createRenderPipeline; the WebGL2 fallback skips
  // its parallel-compile poll). The draw path draws a render object only
  // when its pipeline reports ready and skips the draw otherwise, so after
  // the compile nothing is pending and both presents draw every object.
  //
  // The settled state is presented twice because a canvas at rest shows its
  // composited output one present behind the last canvas present on the
  // software-rendered WebKit build: measured there, after a finish switch at
  // rest the scene state and the recorded frames were already correct while
  // the screen kept showing the previous finish until any later frame
  // rendered. The second present makes the settled state the one on screen;
  // it presents the same scene state, so it changes no pixels.
  //
  // The step runs no retry of its own. The race check it replaced counted
  // the frames around the compile and compiled again whenever one frame had
  // raced the walk, and the walk yields to the main thread between objects,
  // so under continuous motion a compile slower than a frame never won that
  // count: measured on the same build, a finish switch during a camera drag
  // recompiled for the length of the drag and settled only after the drag
  // ended. The order above is the check: a present that follows the compile
  // is drawn with every pipeline ready.
  private async runSettleStep(resources: SettleResources): Promise<void> {
    const { gl, scene, camera, invalidate } = resources
    await gl.compileAsync(scene, camera)
    invalidate()
    await this.clock.onceFrame()
    invalidate()
    await this.clock.onceFrame()
  }
}
