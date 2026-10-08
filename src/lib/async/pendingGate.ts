// A gate over pending work: owners hold the promises a later step must not
// run ahead of, and the step waits for every promise held at the moment it
// asks. Pure promise bookkeeping, no timers and no work of its own.
//
// The gate waits for each held promise to settle, whatever its outcome: the
// owner of the work routes its own failure, and the gate only orders the
// step behind it. A released hold leaves the gate at once, so an owner that
// is gone never holds the step up.

export class PendingGate {
  // One token per hold, so the same promise held twice is released twice.
  private readonly held = new Map<symbol, Promise<unknown>>()

  // Holds the pending work until the returned release is called.
  hold(pending: Promise<unknown>): () => void {
    const token = Symbol('hold')
    this.held.set(token, pending)
    return () => {
      this.held.delete(token)
    }
  }

  // Resolves once every promise held now has settled. It never rejects.
  whenSettled(): Promise<void> {
    return Promise.allSettled([...this.held.values()]).then(() => undefined)
  }
}
