import { isSpringAtRest, stepSpring, type SpringState } from '@lib/explode'
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

// The spring's state now. An anchor at rest short-circuits before any time
// math, so an ageless anchor reads as the rest it holds.
function springAt(anchor: ExplodeAnchor, nowMs: number): SpringState {
  if (isSpringAtRest(anchor.base, anchor.target)) {
    return anchor.base
  }
  const step = stepSpring(
    anchor.base,
    anchor.target,
    (nowMs - anchor.startedAtMs) / 1000,
    explodeSpring,
  )
  return { value: step.value, velocity: step.velocity }
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

export function createExplodeDriver(pose: ExplodePose, nowMs: number): ExplodeDriver {
  let anchor: ExplodeAnchor = { base: { value: 0, velocity: 0 }, startedAtMs: nowMs, target: 0 }
  let applied = 0
  let owesFrames = false
  const feed = createProgressFeed()
  pose.apply(applied)
  feed.emit(applied)

  return {
    retarget(target, nowMs, reducedMotion) {
      if (reducedMotion) {
        anchor = { base: { value: target, velocity: 0 }, startedAtMs: nowMs, target }
        if (applied !== target) {
          pose.apply(target)
          applied = target
          feed.emit(applied)
        }
        owesFrames = true
        return owesFrames
      }
      // The carry-over state is evaluated toward the anchor's own target:
      // toward the new one an ageless anchor would read as already there.
      const current = springAt(anchor, nowMs)
      anchor = { base: current, startedAtMs: nowMs, target }
      owesFrames = current.value !== target || current.velocity !== 0
      return owesFrames
    },
    step(nowMs) {
      const step = stepSpring(
        anchor.base,
        anchor.target,
        (nowMs - anchor.startedAtMs) / 1000,
        explodeSpring,
      )
      // Two independent decisions. The pose is written when the step moved
      // the progress; the loop is kept alive while the spring runs. A frame
      // that landed no movement still owes the next one: dropping the
      // invalidation here would end the move silently on a coarse timer,
      // where the first frame can land inside the retarget's own tick.
      if (step.value !== applied) {
        pose.apply(step.value)
        applied = step.value
        feed.emit(applied)
      }
      owesFrames = !step.atRest
      return owesFrames
    },
    appliedProgress: () => applied,
    moving: () => owesFrames,
    subscribe(listener) {
      const release = feed.subscribe(listener)
      // A new subscriber is caught up at once, with the progress the pose
      // already holds.
      listener(applied)
      return release
    },
    dispose: () => pose.dispose(),
  }
}
