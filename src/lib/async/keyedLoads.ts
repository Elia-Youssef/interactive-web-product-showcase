// One load per key, shared by every reader of that key until the owner
// forgets it. Pure promise bookkeeping, no timers and no load body of its
// own: the owner hands in the one load function.
//
// The entry object is the identity a reader suspends on and holds: every
// read of a live key returns the same entry, so the same promise, which is
// what a suspending reader needs to see across its renders. A forgotten
// entry is never handed out again; the next read of its key starts a fresh
// load, so a released resource is never rendered a second time.

export type KeyedLoad<Value> = {
  readonly key: string
  readonly value: Promise<Value>
}

export class KeyedLoads<Value> {
  private readonly entries = new Map<string, KeyedLoad<Value>>()

  constructor(private readonly load: (key: string) => Promise<Value>) {}

  // The live entry of the key, started on its first read.
  read(key: string): KeyedLoad<Value> {
    const live = this.entries.get(key)
    if (live !== undefined) {
      return live
    }
    const entry: KeyedLoad<Value> = { key, value: this.load(key) }
    this.entries.set(key, entry)
    return entry
  }

  // Forgets the entry, so the next read of its key loads anew. An entry
  // that is no longer the live one of its key is already forgotten, and a
  // later entry of the same key stays live.
  forget(entry: KeyedLoad<Value>): void {
    if (this.entries.get(entry.key) === entry) {
      this.entries.delete(entry.key)
    }
  }
}
