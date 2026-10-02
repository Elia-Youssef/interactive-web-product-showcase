import type { StageProbeKey, StageProbeReads } from './viewerAutomation'

// The per-stage probes of the automation hook: one reader per key, held for
// the lifetime of the component that registered it. An in-canvas component
// that owns live objects (the product look, the stage camera, the finish)
// registers a reader under its key, and the automation hook reads the value
// at access time, so the hook always reports the live object and never a
// copy. The stage creates one instance per mount, like its settle and
// holds; there is no module state and nothing to reset, because a new stage
// has new probes.

// Releases one registration. Fails loudly when the calling registration is
// no longer the key's holder, so a stale cleanup can never drop a reader a
// later registration installed.
export type StageProbeRelease = () => void

type ProbeReader<K extends StageProbeKey> = {
  readonly read: () => StageProbeReads[K]
}

type ProbeReaders = { [K in StageProbeKey]: ProbeReader<K> | null }

export class StageProbes {
  // One slot per probe key. The annotation is the completeness check: a key
  // StageProbeReads gains without a slot here fails the typecheck. The
  // record is replaced whole on each registration, never mutated in place,
  // so a release can compare its reader against the current slot.
  private readers: ProbeReaders = { look: null, camera: null, finish: null, hotspots: null }

  // Holds a reader for the key, for as long as the calling component's
  // effects are live, and returns the release of this one registration. A
  // key is held by one component at a time: a second registration while one
  // is held is a composition error and fails loudly, like a second owner of
  // window.__viewer.
  register<K extends StageProbeKey>(key: K, read: () => StageProbeReads[K]): StageProbeRelease {
    if (this.readers[key] !== null) {
      throw new Error(`the stage probe '${String(key)}' is already held`)
    }
    const reader: ProbeReader<K> = { read }
    // The registration lands as a fresh slots record, so the generic key
    // and its reader travel together and the typecheck holds the pairing.
    this.readers = { ...this.readers, [key]: reader }
    return () => {
      if (this.readers[key] !== reader) {
        throw new Error(
          `the release of the stage probe '${String(key)}' is stale: its registration no longer holds the key`,
        )
      }
      this.readers = { ...this.readers, [key]: null }
    }
  }

  // The probed value, read now, or null while no component holds the key.
  read<K extends StageProbeKey>(key: K): StageProbeReads[K] | null {
    const reader = this.readers[key]
    return reader === null ? null : reader.read()
  }
}
