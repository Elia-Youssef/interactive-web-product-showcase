// The frame step of an eased camera move, in milliseconds: the time the
// controls had no motion to integrate is excluded, everything else counts.
// The stage renders on demand, so the gap between two rendered frames can
// carry a whole idle, and an eased move stepping over that idle would cover
// most of its distance on its first presented frame. But camera-controls
// dispatches its move-start events on every applied input step, not once
// per gesture, so while the controls are in motion those events must not
// re-anchor the step: the time between the previous frame and the step was
// motion time, and the frame's step is the frame gap.

// The step the controls take on the frame at nowMs. While the controls
// were in motion at their last update, the step is the gap to that update,
// whatever move-start events arrived since. While they were asleep, a move
// that started since then anchors the step at its own start: nothing was
// integrating before it, so only its own age counts. With no move and no
// update yet, the step is zero, which moves nothing.
export function moveStepMs(
  nowMs: number,
  lastUpdateMs: number | null,
  moveStartMs: number | null,
  inMotion: boolean,
): number {
  if (inMotion) {
    return lastUpdateMs === null ? 0 : nowMs - lastUpdateMs
  }
  const lastUpdate = lastUpdateMs ?? Number.NEGATIVE_INFINITY
  const moveStart = moveStartMs ?? Number.NEGATIVE_INFINITY
  const anchor = Math.max(lastUpdate, moveStart)
  return anchor === Number.NEGATIVE_INFINITY ? 0 : nowMs - anchor
}
