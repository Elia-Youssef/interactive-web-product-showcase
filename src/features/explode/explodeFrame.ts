import type { FrameOwnerScope } from '@viewer/StageFramePath'
import type { ExplodeDriver } from './explodeDriver'

// The exploded view's place on the stage's frame path. The motion is the
// presented product's code, so its step runs as the content's: a step that
// throws (the spring, the pose, or a reaction riding the driver's progress
// feed) fails the product with the render kind and halts the frames like
// any content step, and never fails the stage.
//
// The priority is the frame path's default, 0: after the stage controls'
// step (-1), which moves the camera, and before the present, the last step
// of every frame. The pose a step writes is therefore the pose the same
// frame presents, and the last frame of a motion presents the final pose.
export const explodeFrame = {
  scope: 'content',
  priority: 0,
} as const satisfies { readonly scope: FrameOwnerScope; readonly priority: number }

// One frame of the motion: the presented view's driver steps to the frame's
// time, and the next frame is owed while the spring still runs. Before the
// view is presented, and after it left, there is no driver and nothing to
// step.
export function stepExplodeFrame(
  driver: ExplodeDriver | null,
  nowMs: number,
  invalidate: () => void,
): void {
  if (driver === null) {
    return
  }
  if (driver.step(nowMs)) {
    invalidate()
  }
}
