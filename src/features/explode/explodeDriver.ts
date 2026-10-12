import { isSpringAtRest, stepSpring, type SpringState, type SpringStepTarget } from '@lib/explode'
import { explodeSpring } from './config'
import type { ExplodePose } from './explodePose'

// The one owner of a presented view's motion: the pose driver, the spring's
// anchor, the target the anchor moves toward, and the progress the pose last
// applied. The store holds what was asked for; this module holds where the
// clip is. Created with its pose in the presented view's layout effect,
// starting at rest on the assembled pose, and disposed with it, so nothing
// about the motion outlives the pose.

// The spring's anchor: the state the motion started from, the moment it
// started, and the target it moves toward. Anchoring the motion at the
// retarget keeps the idle time before it out of the move: a frame gap that
// reaches back past the retarget must not spend the stage's at-rest seconds
// on the spring.
type ExplodeAnchor = {
  base: SpringState
  startedAtMs: number
  target: number
}

// The spring's state now, written into the caller's target record. An
// anchor at rest short-circuits before any time math, so an ageless anchor
// reads as the rest it holds. The state is evaluated toward the anchor's
// own target: toward a newer one, an ageless anchor would read as already
// there.
function springAt(anchor: ExplodeAnchor, nowMs: number, into: SpringStepTarget): SpringState {
  if (isSpringAtRest(anchor.base, anchor.target)) {
    return anchor.base
  }
  stepSpring(anchor.base, anchor.target, (nowMs - anchor.startedAtMs) / 1000, explodeSpring, into)
  return into
}

// A listener of the applied progress. It runs synchronously after every
// pose apply that moved the progress, with the progress that just landed,
// and once at subscribe time with the progress the pose already holds.
export type ExplodeProgressListener = (progress: number) => void

export type ExplodeDriver = {
  // Re-anchors the motion toward the target. Under reduced motion the jump
  // is applied directly. Answers whether a frame is owed.
  readonly retarget: (target: number, nowMs: number, reducedMotion: boolean) => boolean
  // Evaluates the spring toward the anchored target, applies the pose when
  // the progress moved, and answers whether another frame is owed.
  readonly step: (nowMs: number) => boolean
  // The progress the pose last applied.
  readonly appliedProgress: () => number
  // Whether the motion still owes frames.
  readonly moving: () => boolean
  // Holds a listener for the caller's lifetime and calls it at once with the
  // current applied progress. The returned release ends this subscription;
  // a release that is no longer held fails loudly, like a stale stage probe
  // release.
  readonly subscribe: (listener: ExplodeProgressListener) => () => void
  // Disposes the pose. The motion holds nothing else.
  readonly dispose: () => void
}

// The applied progress's feed: the holders of the subscribed listeners, the
// emit after every applied change, and the subscribe with its scoped
// release, which fails loudly when it is no longer held.
function createProgressFeed() {
  const listeners = new Set<{ readonly receive: ExplodeProgressListener }>()
  return {
    emit(applied: number) {
      for (const listener of listeners) {
        listener.receive(applied)
      }
    },
    subscribe(listener: ExplodeProgressListener): () => void {
      const entry = { receive: listener }
      listeners.add(entry)
      return () => {
        if (!listeners.delete(entry)) {
          throw new Error(
            'the release of an explode progress subscription is stale: its listener is no longer subscribed',
          )
        }
      }
    },
  }
}

// The anchor of a jump under reduced motion: the target itself, at rest on
// it, so the next frame reads the pose the jump applied.
function jumpAnchor(target: number, nowMs: number): ExplodeAnchor {
  return { base: { value: target, velocity: 0 }, startedAtMs: nowMs, target }
}

// The anchor a retarget re-anchors to: the motion's state at the moment of
// the retarget, frozen as the base the new motion runs from. The answer
// also says whether that anchor still owes frames.
function reanchor(
  anchor: ExplodeAnchor,
  target: number,
  nowMs: number,
  stepped: SpringStepTarget,
): { anchor: ExplodeAnchor; owesFrames: boolean } {
  const current = springAt(anchor, nowMs, stepped)
  return {
    anchor: {
      base: { value: current.value, velocity: current.velocity },
      startedAtMs: nowMs,
      target,
    },
    owesFrames: current.value !== target || current.velocity !== 0,
  }
}

// The driver's mutable numbers live in a record, not in closure slots: a
// closure slot stores a double as a fresh boxed heap number on every write,
// while a record field holds one mutable box the store lands in.
type AppliedProgress = {
  value: number
}

export function createExplodeDriver(pose: ExplodePose, nowMs: number): ExplodeDriver {
  let anchor: ExplodeAnchor = jumpAnchor(0, nowMs)
  // The spring's step target, owned by the driver so a frame of the motion
  // allocates nothing. The retarget and the frame step never interleave,
  // so one record serves both.
  const stepped: SpringStepTarget = { value: 0, velocity: 0, atRest: true }
  const applied: AppliedProgress = { value: 0 }
  let owesFrames = false
  const feed = createProgressFeed()
  pose.apply(applied.value)
  feed.emit(applied.value)

  return {
    retarget(target, atMs, reducedMotion) {
      if (reducedMotion) {
        anchor = jumpAnchor(target, atMs)
        if (applied.value !== target) {
          pose.apply(target)
          applied.value = target
          feed.emit(applied.value)
        }
        owesFrames = true
        return owesFrames
      }
      const reanchored = reanchor(anchor, target, atMs, stepped)
      anchor = reanchored.anchor
      owesFrames = reanchored.owesFrames
      return owesFrames
    },
    step(nowMs) {
      const elapsed = (nowMs - anchor.startedAtMs) / 1000
      stepSpring(anchor.base, anchor.target, elapsed, explodeSpring, stepped)
      // Two independent decisions. The pose is written when the step moved
      // the progress; the loop is kept alive while the spring runs. A frame
      // that landed no movement still owes the next one: dropping the
      // invalidation here would end the move silently on a coarse timer,
      // where the first frame can land inside the retarget's own tick.
      if (stepped.value !== applied.value) {
        pose.apply(stepped.value)
        applied.value = stepped.value
        feed.emit(applied.value)
      }
      owesFrames = !stepped.atRest
      return owesFrames
    },
    appliedProgress: () => applied.value,
    moving: () => owesFrames,
    subscribe(listener) {
      const release = feed.subscribe(listener)
      // A new subscriber is caught up at once, with the progress the pose
      // already holds.
      listener(applied.value)
      return release
    },
    dispose: () => pose.dispose(),
  }
}
