import { asError } from '@lib/errors'

// The stage's frame path as the owner of what a frame throws, one instance
// per canvas mount. Every step a frame runs on behalf of the stage goes
// through it, and the path tells two kinds of step apart by where they run:
//
// - A frame step of code (a frame callback, or a listener of the presented
//   frames) runs outside three's render. One that throws halts the path: no
//   later step runs, so the failed code is never run again, and the error
//   reaches the owner of the frames once. The path presents again once that
//   owner lets go, which is its word that the failed code has left.
// - The present runs inside three's render, and three's renderer has no
//   unwinding for a throw there: its render target, call depth, render
//   tree, lighting and backend pass stay where the throw left them, so
//   every later render draws offscreen and never reaches the canvas. A
//   present that throws therefore retires the path for good: the error
//   reaches the owner once, the path never runs another step, and the stage
//   is told, so new content gets a fresh canvas and renderer instead of the
//   broken one. Nothing of three's state is reset by hand.
//
// Nothing is retried and nothing is swallowed: a step that throws is
// reported, and a step on a halted or retired path is skipped, never queued
// for later.
//
// Two scopes can own the frames: the stage's own renderer channel, and the
// content (the presented product) while it is on the stage. A frame step of
// code names the scope whose code it is, so a throw reaches the owner of
// that scope: the stage camera's step fails the stage, a product's step
// fails the product. The present draws the whole scene and cannot tell
// whose object threw, so it reaches the narrowest scope holding an owner. A
// scope with no owner hands its failure to the broader one. The precedence
// is by scope, never by registration order, since React runs a child's
// effects before its parent's. Pure bookkeeping, no React and no three.js.

// The report an owner registers: it receives the error a frame step threw.
export type FrameFailureReport = (error: Error) => void

// A listener of the presented frames: it runs once after every frame the
// stage presented, never after one that failed or was skipped.
export type PresentedFrameListener = () => void

// The scopes that can own the stage's frames, narrowest first: a failure
// reaches the first owned scope from the one it names, broader on.
export const frameOwnerScopes = ['content', 'stage'] as const
export type FrameOwnerScope = (typeof frameOwnerScopes)[number]

// What the path needs of its canvas: the canvas's invalidate, which asks
// for the frame that shows the scene again after a halt and the first frame
// a new listener is owed, and the stage's word that this canvas's renderer
// is retired.
export type StageFramePathHost = {
  readonly invalidate: () => void
  readonly retired: () => void
}

type FrameOwner = {
  readonly report: FrameFailureReport
}

// A listener entry keeps its own liveness, so releasing it is a plain flag
// and a run needs no snapshot of the subscription set.
type FrameListener = {
  readonly scope: FrameOwnerScope
  readonly listener: PresentedFrameListener
  held: boolean
}

type FramePathState =
  | { readonly kind: 'presenting' }
  // Halted by the frame step failure the owner received; the path presents
  // again once that owner releases its registration.
  | { readonly kind: 'halted'; readonly by: FrameOwner }
  // A present threw: the renderer is broken for good.
  | { readonly kind: 'retired' }

export class StageFramePath {
  private readonly owners = new Map<FrameOwnerScope, FrameOwner>()
  private readonly listeners: FrameListener[] = []
  private readonly retirementSubscribers = new Set<() => void>()
  private state: FramePathState = { kind: 'presenting' }
  // Whether a listener run is in progress: releases during it defer their
  // entry's removal to its end.
  private runningListeners = false

  constructor(private readonly host: StageFramePathHost) {}

  // Whether a present threw on this canvas: its renderer is retired for
  // good, so it takes no new content. A reader in render subscribes to it
  // through subscribeRetirement.
  get isRetired(): boolean {
    return this.state.kind === 'retired'
  }

  // Subscribes to the retirement of this canvas's renderer, the one change
  // isRetired can make; the callback runs once, when it happens. Stable for
  // the path's life, so React's external store subscription can hold it.
  readonly subscribeRetirement = (callback: () => void): (() => void) => {
    this.retirementSubscribers.add(callback)
    return () => {
      this.retirementSubscribers.delete(callback)
    }
  }

  // Registers the owner of one scope. A scope holds one owner at a time, so
  // a second owner is a composition error and fails loudly. The returned
  // release is bound to this registration: it lets the scope go, and, when
  // this owner's failure halted the path, presents again.
  own(scope: FrameOwnerScope, report: FrameFailureReport): () => void {
    if (this.owners.has(scope)) {
      throw new Error(`the stage frames already have an owner for the ${scope} scope`)
    }
    const owner: FrameOwner = { report }
    this.owners.set(scope, owner)
    return () => this.release(scope, owner)
  }

  // Subscribes a listener of the presented frames, run as a frame step of
  // the named scope's code. Subscribing owes one frame: under demand mode a
  // listener that arrives while the stage is at rest would otherwise wait
  // for a frame nothing scheduled. The release is bound to this
  // subscription, and a stale one fails loudly. A release outside a run
  // drops the entry at once; during a run the entry stays until the run's
  // end, its flag deciding whether it runs.
  listen(scope: FrameOwnerScope, listener: PresentedFrameListener): () => void {
    const entry: FrameListener = { scope, listener, held: true }
    this.listeners.push(entry)
    this.host.invalidate()
    return () => {
      if (!entry.held) {
        throw new Error('the release of a presented-frame listener is stale')
      }
      entry.held = false
      if (!this.runningListeners) {
        this.dropReleasedListeners()
      }
    }
  }

  // Runs one frame step of the named scope's code. Returns true when the
  // step ran to its end, false when the path is halted or retired or the
  // step threw, which halts the path.
  run(scope: FrameOwnerScope, step: () => void): boolean {
    return this.guard(step, scope, 'halted')
  }

  // Runs the present, the step inside three's render. Returns true when it
  // presented, false when the path is halted or retired or the present
  // threw, which retires the path.
  present(render: () => void): boolean {
    if (this.state.kind !== 'presenting') {
      return false
    }
    // From a presenting path, the guard returns false only for a present
    // that threw: the one transition into retired, told to the stage and
    // the retirement subscribers once.
    const presented = this.guard(render, frameOwnerScopes[0], 'retired')
    if (!presented) {
      this.host.retired()
      for (const callback of [...this.retirementSubscribers]) {
        callback()
      }
    }
    return presented
  }

  // Runs every listener of the presented frames once, each as a frame step
  // of its own scope, so a listener that throws halts the path and fails its
  // owner like a frame callback. The listeners after a failed one do not
  // run. Called only after a frame presented.
  //
  // The run covers the subscriptions it began with, in subscription order:
  // a listener added during the run first runs on the next one, and a
  // listener released during the run, by itself or by an earlier one, does
  // not run again in it. The liveness flags make that rule a plain walk
  // over the entries, with the released ones dropped before the run begins
  // and again at its end, so a run allocates no snapshot of the
  // subscription set and no released entry lingers past it.
  runListeners(): void {
    this.dropReleasedListeners()
    this.runningListeners = true
    const count = this.listeners.length
    try {
      for (let index = 0; index < count; index += 1) {
        const entry = this.listeners[index]
        if (entry === undefined || !entry.held) {
          continue
        }
        if (!this.run(entry.scope, entry.listener)) {
          return
        }
      }
    } finally {
      this.runningListeners = false
      this.dropReleasedListeners()
    }
  }

  // Runs a step unless the path is halted or retired. A step that throws
  // moves the path to the state its failure calls for and reaches the owner
  // of the named scope, or of the first broader scope holding one, once; with
  // no owner there it rethrows, since a failure is never swallowed. The
  // failure's kind travels as a flag, so the path builds the one state
  // record only when a failure actually happened.
  private guard(step: () => void, scope: FrameOwnerScope, onThrow: 'halted' | 'retired'): boolean {
    if (this.state.kind !== 'presenting') {
      return false
    }
    try {
      step()
      return true
    } catch (cause) {
      const owner = this.ownerFrom(scope)
      if (owner === null) {
        throw cause
      }
      this.state = onThrow === 'halted' ? { kind: 'halted', by: owner } : { kind: 'retired' }
      owner.report(asError(cause))
      return false
    }
  }

  // Removes the released entries in place, so steady runs walk a stable
  // array and only subscriptions change its length.
  private dropReleasedListeners(): void {
    let write = 0
    for (let read = 0; read < this.listeners.length; read += 1) {
      const entry = this.listeners[read]
      if (entry !== undefined && entry.held) {
        this.listeners[write] = entry
        write += 1
      }
    }
    this.listeners.length = write
  }

  private ownerFrom(scope: FrameOwnerScope): FrameOwner | null {
    for (const candidate of frameOwnerScopes.slice(frameOwnerScopes.indexOf(scope))) {
      const owner = this.owners.get(candidate)
      if (owner !== undefined) {
        return owner
      }
    }
    return null
  }

  private release(scope: FrameOwnerScope, owner: FrameOwner): void {
    if (this.owners.get(scope) === owner) {
      this.owners.delete(scope)
    }
    if (this.state.kind === 'halted' && this.state.by === owner) {
      this.state = { kind: 'presenting' }
      this.host.invalidate()
    }
  }
}
