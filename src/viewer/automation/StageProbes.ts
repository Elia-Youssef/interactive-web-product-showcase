import type { ViewerFinish, ViewerLook } from './viewerAutomation'

// The per-stage probes of the automation hook: one reader per key, held for
// the lifetime of the component that registered it. An in-canvas component
// that owns live objects (the product look, the camera or the finish state)
// registers a reader under its key, and the automation hook reads the value
// at access time, so the hook always reports the live object and never a
// copy. The stage creates one instance per mount, like its settle and holds;
// there is no module state and nothing to reset, because a new stage has new
// probes.

// The probe keys of the stage, one entry per automation channel a component
// can expose. A new channel adds its key here, so a misspelled
// key fails the typecheck and a read of an unregistered one returns null.
export type StageProbeReads = {
  look: ViewerLook
  finish: ViewerFinish
}

type StageProbeKey = keyof StageProbeReads

type ProbeReader<K extends StageProbeKey> = {
  read: () => StageProbeReads[K]
}

type ProbeReaders = { [K in StageProbeKey]: ProbeReader<K> | null }

export class StageProbes {
  private readonly readers: ProbeReaders = { look: null, finish: null }

  // Holds a reader for the key, for as long as the calling component's
  // effects are live. A key is held by one component at a time: a second
  // registration while one is held is a composition error and fails loudly,
  // like a second owner of window.__viewer.
  register<K extends StageProbeKey>(key: K, read: () => StageProbeReads[K]): void {
    if (this.readers[key] !== null) {
      throw new Error(`the stage probe '${String(key)}' is already held`)
    }
    this.hold(key, { read })
  }

  // Drops the reader when the registering component's effect cleanup runs.
  unregister(key: StageProbeKey): void {
    this.readers[key] = null
  }

  // The probed value, read now, or null while no component holds the key.
  read<K extends StageProbeKey>(key: K): StageProbeReads[K] | null {
    const reader = this.readers[key]
    return reader === null ? null : reader.read()
  }

  // The one write into the keyed record. Reads through the generic key keep
  // it typed, but a write through it must satisfy every slot at once, which
  // no reader of one key can. The register signature binds each reader to
  // its key and the key never moves after the write, so each case here
  // states that binding for its own slot.
  private hold<K extends StageProbeKey>(key: K, reader: ProbeReader<K>): void {
    switch (key) {
      case 'look':
        this.readers.look = reader as ProbeReader<'look'>
        return
      case 'finish':
        this.readers.finish = reader as ProbeReader<'finish'>
        return
    }
  }
}
