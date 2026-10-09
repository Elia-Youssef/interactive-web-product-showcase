import { TaskChain } from '@lib/async/taskChain'
import type { FrameClock } from './FrameClock'

// The stage's serialized scene settle, one instance per mount like the frame
// clock and the model watch. Every post-mount scene mutation goes through
// it: a settle presents the settled state twice and resolves only when both
// frames are recorded. The stage's settled promise is the chain's drain, so
// a mutation pushed while another settle presents is included before the
// waiter moves on.

// The one stage capability the settle uses, stated structurally: the stage
// hands the invalidate over, and a test can stand in for it. The settle
// holds no renderer handle, so it cannot start a compile walk.
export type SettleResources = {
  readonly invalidate: () => void
}

export class StageSettle {
  private readonly chain = new TaskChain()

  constructor(private readonly clock: Pick<FrameClock, 'onceFrame'>) {}

  // Settles the scene as it stands when the step runs. Resolves when every
  // settle pushed before it, this one, and any pushed while it presented
  // have presented twice.
  settle(resources: SettleResources): Promise<void> {
    return this.chain.push(() => this.runSettleStep(resources))
  }

  // One settle step: present the settled state twice, each present on its
  // own recorded frame.
  //
  // The presents build every pipeline they draw, on the frame path: a frame
  // render creates each render object's pipeline with no promises array,
  // which completes within the call on both backends (device.createRenderPipeline,
  // three's src/renderers/webgpu/utils/WebGPUPipelineUtils.js:260;
  // _completeCompile, three's src/renderers/webgl-fallback/WebGLBackend.js:1581),
  // so the frame that reaches an object draws it and no pipeline outlives
  // the frame that needed it.
  //
  // The step starts no compile walk. A compile walks the scene's objects one
  // by one and yields to the engine's frame scheduling between them (three's
  // src/renderers/common/Renderer.js:1099), and on the software-rendered
  // WebKit build a walk was followed by the page's frame supply stopping:
  // the engine stopped servicing requestAnimationFrame for the whole page,
  // so the settle's frames were never recorded and the chain parked for
  // good.
  //
  // The settled state is presented twice because a canvas at rest shows its
  // composited output one present behind the last canvas present on the
  // software-rendered WebKit build: measured there, after a finish switch at
  // rest the scene state and the recorded frames were already correct while
  // the screen kept showing the previous finish until any later frame
  // rendered. The second present makes the settled state the one on screen;
  // it presents the same scene state, so it changes no pixels.
  //
  // A frame that did not present is never recorded. A recoverable frame
  // step failure holds the wait until its owner leaves and frames resume.
  // A retired or disposed frame supply rejects every waiter instead; that
  // typed reason propagates unchanged through the settle and its chain.
  private async runSettleStep(resources: SettleResources): Promise<void> {
    resources.invalidate()
    await this.clock.onceFrame()
    resources.invalidate()
    await this.clock.onceFrame()
  }
}
