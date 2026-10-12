import { moveStepMs } from '@lib/camera/moveStep'

// The controls' frame step, in seconds, on one mount: it holds the state
// the step rule reads, the previous update, the current move's start and
// whether the controls were in motion at their last update, so an eased
// move's clock starts when the move ends an idle and never steps over the
// idle the stage sat through, while a running motion keeps stepping by the
// frame gap whatever input events arrive. The mount hook feeds it
// performance.now timestamps at the controls' move-start events, at every
// frame, and with what the controls' own update returned; the tests feed
// it virtual ones.

// The controls' update takes seconds; the timestamps are milliseconds.
const MS_PER_SECOND = 1000

export class ControlsFrameClock {
  private lastUpdateMs: number | null = null
  private moveStartMs: number | null = null
  private inMotion = false

  // Records where the current move starts: the controls' move-start
  // events, transitionstart and controlstart. camera-controls dispatches
  // both on every applied input step, not once per gesture, so this only
  // matters as an anchor while the controls are asleep; while they are in
  // motion the step ignores it.
  beginMove(atMs: number): void {
    this.moveStartMs = atMs
  }

  // The step for the frame at nowMs, in seconds, and the recording of that
  // frame as the next step's anchor.
  stepSeconds(nowMs: number): number {
    const stepMs = moveStepMs(nowMs, this.lastUpdateMs, this.moveStartMs, this.inMotion)
    this.lastUpdateMs = nowMs
    return stepMs / MS_PER_SECOND
  }

  // What the controls' own update returned for the frame just stepped:
  // whether it moved anything. This is the asleep signal, our own record of
  // the update's return value, and it decides whether the next step reads
  // the move-start anchor or the frame gap.
  recordUpdate(updated: boolean): void {
    this.inMotion = updated
  }
}
