import { asError } from '@lib/errors'

// The stage's frame path as the owner of what a frame throws, one instance
// per canvas mount. Every step a frame runs on behalf of the stage goes
// through it: the present, each frame callback, and each listener of the
// presented frames. A step that throws halts the path: no later step runs,
// so the failed code is never run again, and the error reaches the owner of
// the frames once. The path presents again once that owner lets go, which
// is its word that the failed code has left. Nothing is retried and nothing
// is swallowed: a step that throws is reported, and a step on a halted path
// is skipped, never queued for later.
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
// a new listener is owed.
export type StageFramePathHost = {
  readonly invalidate: () => void
}

type FrameOwner = {
  readonly report: FrameFailureReport
}

type FrameListener = {
  readonly scope: FrameOwnerScope
  readonly listener: PresentedFrameListener
}

type FramePathState =
  | { readonly kind: 'presenting' }
  // Halted by the frame step failure the owner received; the path presents
  // again once that owner releases its registration.
  | { readonly kind: 'halted'; readonly by: FrameOwner }

export class StageFramePath {
  private readonly owners = new Map<FrameOwnerScope, FrameOwner>()
  private readonly listeners = new Set<FrameListener>()
  private state: FramePathState = { kind: 'presenting' }

  constructor(private readonly host: StageFramePathHost) {}

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
  // subscription, and a stale one fails loudly.
  listen(scope: FrameOwnerScope, listener: PresentedFrameListener): () => void {
    const entry: FrameListener = { scope, listener }
    this.listeners.add(entry)
    this.host.invalidate()
    return () => {
      if (!this.listeners.delete(entry)) {
        throw new Error('the release of a presented-frame listener is stale')
      }
    }
  }

  // Runs one frame step of the named scope's code. Returns true when the
  // step ran to its end, false when the path is halted or the step threw,
  // which halts the path.
  run(scope: FrameOwnerScope, step: () => void): boolean {
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
      this.state = { kind: 'halted', by: owner }
      owner.report(asError(cause))
      return false
    }
  }

  // Runs the present. It draws the whole scene and cannot tell whose object
  // threw, so it runs as a step of the narrowest scope.
  present(render: () => void): boolean {
    return this.run(frameOwnerScopes[0], render)
  }

  // Runs every listener of the presented frames once, each as a frame step
  // of its own scope, so a listener that throws halts the path and fails its
  // owner like a frame callback. The listeners after a failed one do not
  // run. Called only after a frame presented.
  runListeners(): void {
    for (const { scope, listener } of [...this.listeners]) {
      if (!this.run(scope, listener)) {
        return
      }
    }
  }

  // The owner of the named scope, or of the first broader scope holding
  // one; with none, the caller rethrows, since a failure is never
  // swallowed.
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
