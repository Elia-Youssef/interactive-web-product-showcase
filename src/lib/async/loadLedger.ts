// The byte ledger of one wait's downloads: every transfer the loads start,
// named by its URL, with the bytes it has read, the size it claims and
// whether the wait wants it. Pure bookkeeping, no timers and no DOM: the
// loads report into it through the reporters it issues, and the wait's owner
// reads and resets it.
//
// The figure it yields sums the wanted transfers only, so a read ahead never
// shows; a model load that takes a read ahead over makes the same transfer
// wanted and keeps the bytes already read. Any wanted transfer whose size is
// unknown, or whose bytes overrun it (a host that names the compressed size
// while the stream counts decoded bytes), makes the whole figure unknown
// rather than wrong, and so does a wanted size of zero, which never divides.
// Before the first wanted transfer registers, and once every wanted transfer
// has ended, the figure is unknown too: never a completed claim while decode,
// parse and the settle still run. While a figure is known it never moves
// backwards within one wait, whatever order the chunks and the take-overs
// arrive in: a transfer that restarts from nothing cannot take the figure
// with it. A reset ends the wait: the transfers and the watermark leave, so
// the next one sums only its own bytes.

// The bytes one transfer has read, and its whole size when known.
export type ByteProgress = {
  readonly loaded: number
  readonly total: number | null
}

// Reports one transfer's byte progress and its end into the ledger that
// issued it. The reader of the transfer's stream owns the calls: the reports
// carry cumulative bytes, so a reporter whose ledger was reset underneath it
// re-registers its transfer at the true count.
export type TransferReporter = {
  readonly bytes: (reading: ByteProgress) => void
  readonly ended: () => void
}

// The wait's figure: the share of the wanted bytes read, or null while it
// has none to show.
export type LoadReading = {
  readonly fraction: number | null
}

type TransferEntry = {
  loaded: number
  total: number | null
  wanted: boolean
  ended: boolean
}

export class LoadLedger {
  private readonly entries = new Map<string, TransferEntry>()
  private readonly listeners = new Set<() => void>()
  private watermark: number | null = null

  // Watches every change: the loads report chunks, the wait's owner mirrors
  // the figure. The stop function removes the listener.
  subscribe(listener: () => void): () => void {
    this.listeners.add(listener)
    return () => {
      this.listeners.delete(listener)
    }
  }

  // Registers the transfer of the URL and answers its reporter. A transfer
  // already registered keeps the bytes it has read; a wanted registration on
  // an unwanted transfer takes it over, and nothing un-wants one afterwards,
  // so the read ahead a model load took over stays wanted however its own
  // reporter keeps reporting.
  transfer(url: string, wanted: boolean): TransferReporter {
    this.claim(url, wanted)
    return {
      bytes: (reading) => this.record(url, wanted, reading),
      ended: () => this.end(url),
    }
  }

  // The wait's figure right now: the share of the wanted bytes read, held at
  // the highest share this wait has shown, or null while no share shows.
  read(): LoadReading {
    if (this.currentFraction() === null) {
      return { fraction: null }
    }
    return { fraction: this.watermark }
  }

  // Ends the wait: the transfers that ended leave with the watermark, and
  // the transfers still running stay with their wanted state and their
  // bytes, so a wait that starts beside a download already in flight sums
  // it from its true count instead of losing it. The next wait's figure
  // starts from its own reads.
  reset(): void {
    let droppedAny = false
    for (const [url, entry] of this.entries) {
      if (entry.ended) {
        this.entries.delete(url)
        droppedAny = true
      }
    }
    const hadFigure = this.watermark !== null
    this.watermark = null
    if (droppedAny || hadFigure) {
      this.changed()
    }
  }

  private claim(url: string, wanted: boolean): void {
    const entry = this.entries.get(url)
    if (entry === undefined) {
      this.entries.set(url, { loaded: 0, total: null, wanted, ended: false })
      this.changed()
      return
    }
    if (wanted && !entry.wanted) {
      entry.wanted = true
      this.changed()
    }
  }

  private record(url: string, wanted: boolean, reading: ByteProgress): void {
    const entry = this.entries.get(url)
    if (entry === undefined) {
      // A transfer this ledger no longer hold ended before the wait it
      // belonged to left; the bytes it still reports belong to a figure
      // nobody reads.
      return
    }
    entry.loaded = reading.loaded
    entry.total = reading.total
    entry.wanted = entry.wanted || wanted
    // A transfer that reports again after its end has restarted: a failed
    // read ahead whose load fetches the file itself.
    entry.ended = false
    this.changed()
  }

  private end(url: string): void {
    const entry = this.entries.get(url)
    if (entry === undefined || entry.ended) {
      return
    }
    entry.ended = true
    this.changed()
  }

  // The share of the wanted bytes read, before the watermark holds it: null
  // while no wanted transfer is registered, while any of them runs without a
  // usable size, and once none of them still lacks bytes. That last rule
  // keys on the bytes themselves, not on the reader's end note: a transfer
  // whose last byte is read is complete while its decode and parse still
  // run, and the wait holds no figure for it to claim.
  private currentFraction(): number | null {
    let wantedAny = false
    let lackingBytes = false
    let loaded = 0
    let total: number | null = 0
    for (const entry of this.entries.values()) {
      if (!entry.wanted) {
        continue
      }
      wantedAny = true
      const everyByteIn =
        entry.ended || (entry.total !== null && entry.total > 0 && entry.loaded >= entry.total)
      if (!everyByteIn) {
        lackingBytes = true
      }
      loaded += entry.loaded
      if (entry.total === null || entry.total <= 0 || entry.loaded > entry.total) {
        total = null
      } else if (total !== null) {
        total += entry.total
      }
    }
    if (!wantedAny || !lackingBytes || total === null || total <= 0) {
      return null
    }
    return Math.min(1, Math.max(0, loaded / total))
  }

  private changed(): void {
    const fraction = this.currentFraction()
    if (fraction !== null && (this.watermark === null || fraction > this.watermark)) {
      this.watermark = fraction
    }
    for (const listener of this.listeners) {
      listener()
    }
  }
}
