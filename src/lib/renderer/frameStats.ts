// The exact math behind the dev HUD's frame rates. Nothing here rounds or
// formats: the HUD owns display formatting, this module owns the numbers.

// The rolling window the statistics cover, in milliseconds. A frame belongs
// to the window while its completion time is within this length before now,
// so a rate that stops falls to exactly 0 once the window passes.
export const frameWindowMs = 1000

// The highest display rate the statistics count in full. A faster display
// still measures correctly, but its oldest records in the window are evicted
// before they can age out by time.
export const frameRateMaxHz = 240

// How many frame records the ring buffer holds: one slot per frame the
// window can contain at the maximum counted rate. Eviction by time keeps
// the window correct for any faster display.
export const frameRecordCapacity = Math.ceil((frameWindowMs / 1000) * frameRateMaxHz)

export type FrameRecord = {
  // When the frame finished, in the clock the caller samples (the DOM's
  // performance.now in the app).
  atMs: number
  // How long the whole render tick took on the CPU: the span of R3F's loop
  // pass that rendered the frame, from its before-effect to its
  // after-effect. GPU time is a different measurement this module never sees.
  tickMs: number
}

export type FrameStats = {
  // Frames per second over the window: the frames in the window divided by
  // the window's length in seconds.
  fps: number
  // The mean tick CPU time of the frames in the window, or null when the
  // window holds none.
  meanTickMs: number | null
}

// The statistics of the frames that fall inside the window ending at nowMs.
// Records are the live window content in any order; the window cut happens
// here so the rate semantics live in exactly one place.
export function frameStats(records: readonly FrameRecord[], nowMs: number): FrameStats {
  const oldestMs = nowMs - frameWindowMs
  let count = 0
  let tickMsSum = 0
  for (const record of records) {
    if (record.atMs < oldestMs) {
      continue
    }
    count += 1
    tickMsSum += record.tickMs
  }
  return {
    fps: count / (frameWindowMs / 1000),
    meanTickMs: count === 0 ? null : tickMsSum / count,
  }
}
