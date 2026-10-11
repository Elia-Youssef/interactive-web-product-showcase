import { describe, expect, it } from 'vitest'
import { LoadLedger } from './loadLedger'

// The ledger of one wait's downloads, as pure bookkeeping: the figure it
// yields follows the rules the readout depends on, whatever order the loads
// report in. Every case here drives the ledger only through the reporter
// surface its sources use.

const env = '/env/studio.hdr'
const model = '/models/one/model.glb'

function fractionOf(ledger: LoadLedger): number | null {
  return ledger.read().fraction
}

describe('LoadLedger', () => {
  it('yields no figure before the first transfer registers', () => {
    expect(fractionOf(new LoadLedger())).toBeNull()
  })

  it('yields no figure while the only registered transfer is not wanted', () => {
    const ledger = new LoadLedger()
    const ahead = ledger.transfer(model, false)

    ahead.bytes({ loaded: 400, total: 1000 })

    expect(fractionOf(ledger)).toBeNull()
  })

  it('sums the wanted transfers together', () => {
    const ledger = new LoadLedger()
    const environment = ledger.transfer(env, true)
    const modelBytes = ledger.transfer(model, true)

    environment.bytes({ loaded: 1000, total: 1000 })
    modelBytes.bytes({ loaded: 1000, total: 3000 })

    expect(fractionOf(ledger)).toBe(0.5)
  })

  it('makes a taken over read ahead wanted, keeping the bytes it has read', () => {
    const ledger = new LoadLedger()
    const ahead = ledger.transfer(model, false)
    ahead.bytes({ loaded: 250, total: 1000 })

    const taken = ledger.transfer(model, true)

    expect(fractionOf(ledger)).toBe(0.25)
    // The stream the read ahead started keeps reporting through its own
    // reporter, and the bytes it reads still count for the wanted transfer.
    taken.bytes({ loaded: 500, total: 1000 })
    ahead.bytes({ loaded: 750, total: 1000 })
    expect(fractionOf(ledger)).toBe(0.75)
  })

  it('never undoes a taken over transfer through the read ahead reporter', () => {
    const ledger = new LoadLedger()
    const ahead = ledger.transfer(model, false)
    ahead.bytes({ loaded: 500, total: 1000 })
    ledger.transfer(model, true)

    ahead.bytes({ loaded: 600, total: 1000 })

    expect(fractionOf(ledger)).toBe(0.6)
  })

  it('yields no figure while any wanted transfer total is unknown', () => {
    const ledger = new LoadLedger()
    const environment = ledger.transfer(env, true)
    const bytes = ledger.transfer(model, true)
    environment.bytes({ loaded: 1000, total: 1000 })

    bytes.bytes({ loaded: 500, total: null })

    expect(fractionOf(ledger)).toBeNull()
  })

  it('yields no figure when read bytes overrun the total', () => {
    const ledger = new LoadLedger()
    const bytes = ledger.transfer(model, true)

    bytes.bytes({ loaded: 1200, total: 1000 })

    expect(fractionOf(ledger)).toBeNull()
  })

  it('never divides by a zero total', () => {
    const ledger = new LoadLedger()
    const bytes = ledger.transfer(model, true)

    bytes.bytes({ loaded: 0, total: 0 })

    expect(fractionOf(ledger)).toBeNull()
  })

  it('holds no figure once both wanted transfers have every byte in', () => {
    const ledger = new LoadLedger()
    const first = ledger.transfer(model, true)
    const second = ledger.transfer(env, true)
    first.bytes({ loaded: 1000, total: 1000 })
    second.bytes({ loaded: 1000, total: 1000 })

    expect(fractionOf(ledger)).toBeNull()
  })

  it('yields no figure once every wanted transfer has ended', () => {
    const ledger = new LoadLedger()
    const environment = ledger.transfer(env, true)
    const bytes = ledger.transfer(model, true)
    environment.bytes({ loaded: 1000, total: 1000 })
    bytes.bytes({ loaded: 3000, total: 3000 })
    environment.ended()
    bytes.ended()

    expect(fractionOf(ledger)).toBeNull()
  })

  it('keeps the figure of the transfers that still run beside an ended one', () => {
    const ledger = new LoadLedger()
    const environment = ledger.transfer(env, true)
    const bytes = ledger.transfer(model, true)
    environment.bytes({ loaded: 1000, total: 1000 })
    environment.ended()
    bytes.bytes({ loaded: 1500, total: 3000 })

    expect(fractionOf(ledger)).toBe(0.625)
  })

  it('re-opens an ended transfer that reports again, never below the figure shown', () => {
    const ledger = new LoadLedger()
    const bytes = ledger.transfer(model, true)
    bytes.bytes({ loaded: 400, total: 1000 })
    bytes.ended()
    // Every wanted transfer ended: the wait holds no figure while the
    // fallback fetch has not reported yet.
    expect(fractionOf(ledger)).toBeNull()

    bytes.bytes({ loaded: 100, total: 1000 })
    expect(fractionOf(ledger)).toBe(0.4)

    bytes.bytes({ loaded: 600, total: 1000 })
    expect(fractionOf(ledger)).toBe(0.6)
  })

  it('never moves the figure backwards when a transfer restarts from nothing', () => {
    const ledger = new LoadLedger()
    const first = ledger.transfer(model, true)
    first.bytes({ loaded: 800, total: 1000 })
    expect(fractionOf(ledger)).toBe(0.8)

    // The take-over fallback fetches the file itself, from zero bytes.
    const restart = ledger.transfer(model, true)
    restart.bytes({ loaded: 100, total: 1000 })

    expect(fractionOf(ledger)).toBe(0.8)
  })

  it('resets the figure and the watermark when a new wait begins', () => {
    const ledger = new LoadLedger()
    const first = ledger.transfer(model, true)
    first.bytes({ loaded: 900, total: 1000 })
    first.ended()
    ledger.reset()

    expect(fractionOf(ledger)).toBeNull()

    const second = ledger.transfer(model, true)
    second.bytes({ loaded: 200, total: 1000 })
    expect(fractionOf(ledger)).toBe(0.2)
  })

  it('drops a transfer that ended before the wait it belonged to left', () => {
    const ledger = new LoadLedger()
    const reporter = ledger.transfer(model, true)
    reporter.bytes({ loaded: 300, total: 1000 })
    reporter.ended()
    ledger.reset()

    reporter.bytes({ loaded: 700, total: 1000 })

    expect(fractionOf(ledger)).toBeNull()
  })

  it('tells its listeners about every change, and stops telling them', () => {
    const ledger = new LoadLedger()
    let changes = 0
    const stop = ledger.subscribe(() => {
      changes += 1
    })
    const reporter = ledger.transfer(model, true)

    reporter.bytes({ loaded: 1, total: 10 })
    reporter.ended()
    stop()
    reporter.bytes({ loaded: 2, total: 10 })

    expect(changes).toBe(3)
  })
})

describe('a wait that ends beside running transfers', () => {
  it('keeps the running transfer with its bytes, and a fresh watermark', () => {
    const ledger = new LoadLedger()
    const environment = ledger.transfer(env, true)
    const bytes = ledger.transfer(model, true)
    environment.bytes({ loaded: 1000, total: 1000 })
    bytes.bytes({ loaded: 600, total: 4000 })
    expect(fractionOf(ledger)).toBe(1600 / 5000)
    bytes.ended()
    // The model's read ended: every transfer holds the bytes it will get,
    // so the wait shows no figure while the settles run.
    expect(fractionOf(ledger)).toBeNull()

    ledger.reset()

    // The ended transfer leaves; the running one keeps its bytes, and a
    // transfer the new wait starts sums with them from a fresh watermark.
    const restarted = ledger.transfer(model, true)
    restarted.bytes({ loaded: 600, total: 4000 })
    expect(fractionOf(ledger)).toBe(1600 / 5000)
  })

  it('keeps a running transfer that was only claimed, before its first report', () => {
    const ledger = new LoadLedger()
    const environment = ledger.transfer(env, true)
    ledger.transfer(model, true)
    ledger.transfer(model, true).ended()
    ledger.reset()

    // The environment was claimed by the stage's committed effect before
    // the wait began: it survives the reset with nothing read yet.
    expect(fractionOf(ledger)).toBeNull()
    environment.bytes({ loaded: 400, total: 1000 })
    expect(fractionOf(ledger)).toBe(0.4)
  })

  it('ignores the reports of a transfer the reset dropped with its ended wait', () => {
    const ledger = new LoadLedger()
    const ended = ledger.transfer(model, true)
    ended.bytes({ loaded: 800, total: 1000 })
    ended.ended()
    ledger.reset()

    ended.bytes({ loaded: 900, total: 1000 })

    expect(fractionOf(ledger)).toBeNull()
  })
})

describe('a transfer whose every byte is in', () => {
  it('holds no figure while its decode and parse still run', () => {
    const ledger = new LoadLedger()
    const environment = ledger.transfer(env, true)
    environment.bytes({ loaded: 1000, total: 1000 })
    expect(fractionOf(ledger)).toBeNull()
  })

  it('counts a complete running transfer beside one that still lacks bytes', () => {
    const ledger = new LoadLedger()
    const environment = ledger.transfer(env, true)
    const bytes = ledger.transfer(model, true)
    environment.bytes({ loaded: 1000, total: 1000 })
    bytes.bytes({ loaded: 1500, total: 3000 })

    expect(fractionOf(ledger)).toBe(2500 / 4000)
  })
})
