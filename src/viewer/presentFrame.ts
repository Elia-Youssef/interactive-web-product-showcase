import type { StageFramePath } from './StageFramePath'

// One frame of the stage, as pure ordering over the frame path: the present
// runs through the path, the frame is recorded only when it presented, and
// the listeners of the presented frames run only after that record. A
// present that threw, or a path that is halted, records nothing,
// so nothing waiting on a presented frame (the settle's presents, the first
// frame signal) is released by a frame that never reached the canvas.
// Returns whether the frame presented.
export function presentFrame(
  path: StageFramePath,
  render: () => void,
  record: () => void,
): boolean {
  if (!path.present(render)) {
    return false
  }
  record()
  path.runListeners()
  return true
}
