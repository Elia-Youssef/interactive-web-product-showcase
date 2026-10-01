// Holds on loaded resources: a resource is released once nothing holds it
// at the end of the synchronous work that dropped its last hold. Pure
// bookkeeping, no timers of its own: the caller hands in the one scheduling
// step, a callback that runs once the current synchronous work is done.
//
// The rule follows how React runs effects. One passive-effect flush runs
// every cleanup, then every setup, then the StrictMode double invoke, in one
// synchronous call. A hold dropped by a cleanup and taken again by a setup of
// the same flush is therefore one continuing hold: the simulated remount of
// StrictMode, or a resource handed from one component to the next in one
// commit. A hold dropped and not taken again in that flush is gone, and the
// resource is released exactly once. A released resource never comes back:
// holding it again is a lifetime error and fails loudly, since whatever
// renders it would render a released object.

export type AfterFlush = (callback: () => void) => void

export class ResourceHolds<Resource extends object> {
  // Releases waiting for the end of the flush, by resource. An entry leaves
  // when a hold takes the resource again or when its release runs.
  private readonly pending = new Map<Resource, () => void>()
  // Resources whose release has run. Weak, so the record lives only as long
  // as something still references the resource.
  private readonly released = new WeakSet<Resource>()

  constructor(private readonly afterFlush: AfterFlush) {}

  // Takes a hold on a live resource. A release still waiting for the end of
  // the flush is withdrawn.
  hold(resource: Resource): void {
    this.assertLive(resource, 'held')
    this.pending.delete(resource)
  }

  // Drops a hold. Unless a hold takes the resource again before the current
  // synchronous work ends, the release runs then, once.
  drop(resource: Resource, release: () => void): void {
    this.assertLive(resource, 'dropped')
    this.pending.set(resource, release)
    this.afterFlush(() => this.settle(resource, release))
  }

  private settle(resource: Resource, release: () => void): void {
    // A later hold withdrew this release, or a later drop replaced it with
    // its own scheduled run.
    if (this.pending.get(resource) !== release) {
      return
    }
    this.pending.delete(resource)
    this.released.add(resource)
    release()
  }

  private assertLive(resource: Resource, action: 'held' | 'dropped'): void {
    if (this.released.has(resource)) {
      throw new Error(`a released resource was ${action} again: it must be loaded anew`)
    }
  }
}
