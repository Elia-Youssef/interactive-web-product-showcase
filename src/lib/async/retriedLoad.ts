// One load shared by every reader until it fails. Pure promise bookkeeping,
// no timers and no load body of its own: the owner hands in the one load
// function.
//
// Every read while the load is pending or resolved returns the same
// promise. A rejection reaches every reader that already holds that promise
// and is then forgotten, so the next read starts the load again: a failure
// is the failure of the reads that met it, never a state the owner is stuck
// in for the rest of its life.
import { startPromise } from './startPromise'

export class RetriedLoad<Value> {
  private current: Promise<Value> | null = null

  constructor(private readonly load: () => Promise<Value>) {}

  read(): Promise<Value> {
    if (this.current !== null) {
      return this.current
    }
    // A load that throws before returning its promise is a rejection, so
    // every failure takes the one channel.
    const started = startPromise(this.load)
    this.current = started
    void started.then(undefined, () => {
      if (this.current === started) {
        this.current = null
      }
    })
    return started
  }
}
