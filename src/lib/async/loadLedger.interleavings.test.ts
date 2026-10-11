import { describe, expect, it } from 'vitest'
import { LoadLedger, type ByteProgress, type TransferReporter } from './loadLedger'

const model = '/models/one/model.glb'
const env = '/env/studio.hdr'

// Every sequence of events up to a length, over reporters the sequence
// itself issued, checked against the rules no order of reports may break:
// the figure is null or inside the unit interval, and it never moves
// backwards between resets. The reporters keep their own wanted flag, so
// the walk covers a read ahead reporting beside the load that took it over
// and a stale reporter outliving the wait its transfer belonged to.
describe('every report order', () => {
  // One reporter the walk issued, keeping the wanted flag it was given.
  type Issued = { readonly url: string; readonly wanted: boolean }

  type LedgerEvent =
    | { readonly kind: 'issue'; readonly url: string; readonly wanted: boolean }
    | { readonly kind: 'bytes'; readonly from: number; readonly reading: ByteProgress }
    | { readonly kind: 'ended'; readonly from: number }
    | { readonly kind: 'reset' }

  const alphabet: readonly LedgerEvent[] = [
    { kind: 'issue', url: model, wanted: true },
    { kind: 'issue', url: model, wanted: false },
    { kind: 'issue', url: env, wanted: true },
    { kind: 'bytes', from: 0, reading: { loaded: 400, total: 1000 } },
    { kind: 'bytes', from: 1, reading: { loaded: 600, total: 1000 } },
    { kind: 'bytes', from: 1, reading: { loaded: 500, total: null } },
    { kind: 'bytes', from: 2, reading: { loaded: 200, total: 400 } },
    { kind: 'ended', from: 0 },
    { kind: 'ended', from: 2 },
    { kind: 'reset' },
  ]

  function* sequences(length: number): Generator<readonly LedgerEvent[]> {
    if (length === 0) {
      yield []
      return
    }
    for (const prefix of sequences(length - 1)) {
      for (const event of alphabet) {
        yield [...prefix, event]
      }
    }
  }

  it('keeps every rule over every sequence of four events', () => {
    let checkedSequences = 0
    for (const events of sequences(4)) {
      const ledger = new LoadLedger()
      const issued: TransferReporter[] = []
      const issuedState: Issued[] = []
      // The last figure this wait showed: an indeterminate read holds it,
      // because the figure that returns must not fall below it.
      let previous: number | null = null
      for (const event of events) {
        if (event.kind === 'reset') {
          ledger.reset()
          previous = null
        } else if (event.kind === 'issue') {
          issued.push(ledger.transfer(event.url, event.wanted))
          issuedState.push({ url: event.url, wanted: event.wanted })
        } else if (event.kind === 'bytes') {
          const reporter = issued[event.from]
          const owner = issuedState[event.from]
          if (reporter !== undefined && owner !== undefined) {
            ledger.transfer(owner.url, owner.wanted)
            reporter.bytes(event.reading)
          }
        } else {
          const reporter = issued[event.from]
          if (reporter !== undefined) {
            reporter.ended()
          }
        }
        const fraction = ledger.read().fraction
        if (fraction !== null) {
          if (fraction < 0 || fraction > 1) {
            throw new Error(
              `the figure ${fraction} left the unit interval after ${JSON.stringify(events)}`,
            )
          }
          if (previous !== null && fraction < previous) {
            throw new Error(
              `the figure moved ${previous} to ${fraction} after ${JSON.stringify(events)}`,
            )
          }
          previous = fraction
        }
      }
      checkedSequences += 1
    }
    expect(checkedSequences).toBe(alphabet.length ** 4)
  })
})
