// The stage's presented-frame channel: one instance per stage mount, like
// the settle, the holds and the probes. Canvas content subscribes through
// the stage frames context, and the frame observer feeds every loop tick in,
// so a listener runs exactly once per frame the stage's renderer actually
// rendered, after that render, and never on a loop tick that rendered
// nothing. The channel owns none of the per-frame code: the observer stays
// the stage's only per-frame code, and the channel is its fan-out.

export type PresentedFrameListener = () => void

export type PresentedFrameRelease = () => void

export class PresentedFrames {
  private listeners = new Set<PresentedFrameListener>()
  // The renderer's render counter at the last tick this channel judged, so
  // a tick that rendered nothing is told apart from one that did. Null until
  // the frame observer rebases the channel on its effect run.
  private lastRenderCalls: number | null = null
  // The stage's invalidate, owned by the frame observer's effect run. Null
  // until then; the observer's own mount invalidate covers that window.
  private invalidate: (() => void) | null = null

  // The frame observer hands its invalidate over when its effect runs, so a
  // subscription can owe the frame it would otherwise wait forever for.
  ownInvalidate(invalidate: () => void): void {
    this.invalidate = invalidate
  }

  // The frame observer rebases the render counter when its effect (re)runs,
  // so a counter that moved before the run never reads as a frame of this
  // run.
  rebase(renderCalls: number): void {
    this.lastRenderCalls = renderCalls
  }

  // Holds the listener for as long as the caller keeps it and returns the
  // release of this one subscription. Subscribing owes one frame: under
  // demand mode a subscriber that arrives while the stage is at rest would
  // otherwise wait for a frame nothing scheduled, so the subscription
  // invalidates once. A release that is no longer the key's listener fails
  // loudly, like a stale probe release.
  add(listener: PresentedFrameListener): PresentedFrameRelease {
    this.listeners.add(listener)
    this.invalidate?.()
    return () => {
      if (!this.listeners.delete(listener)) {
        throw new Error('the release of a presented-frame listener is stale')
      }
    }
  }

  // Hands one loop tick in, with the renderer's render counter after the
  // tick. Answers whether the tick presented a frame; the listeners run
  // after that render, once, in subscription order, so they read the world
  // and camera matrices the frame used, whichever frame callback wrote them.
  afterRenderTick(renderCalls: number): boolean {
    if (this.lastRenderCalls !== null && renderCalls === this.lastRenderCalls) {
      return false
    }
    this.lastRenderCalls = renderCalls
    for (const listener of [...this.listeners]) {
      listener()
    }
    return true
  }
}
