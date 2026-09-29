// Unit proofs of the console gate bookkeeping: exact counts, open-ended
// counts, and the order and flag cases that once broke the fixture.
import { describe, expect, it } from 'vitest'
import { createErrorLedger } from './errorLedger.ts'

describe('the error ledger', () => {
  it('consumes exactly one matching error without options', () => {
    const ledger = createErrorLedger()
    ledger.expect(/planted/)
    ledger.record('console error: planted')
    expect(ledger.verdict()).toEqual({ unexpected: [], unmet: [] })
  })

  it('leaves a second matching error unexpected when the count is one', () => {
    const ledger = createErrorLedger()
    ledger.expect(/planted/)
    ledger.record('console error: planted')
    ledger.record('console error: planted again')
    expect(ledger.verdict().unexpected).toEqual(['console error: planted again'])
  })

  it('consumes an exact count and reports too few', () => {
    const ledger = createErrorLedger()
    ledger.expect(/planted/, { times: 2 })
    ledger.record('console error: planted')
    const verdict = ledger.verdict()
    expect(verdict.unexpected).toEqual([])
    expect(verdict.unmet).toEqual(['/planted/ expected exactly 2, matched 1'])
  })

  it('reports too many when an exact count sees more errors', () => {
    const ledger = createErrorLedger()
    ledger.expect(/planted/, { times: 2 })
    ledger.record('console error: planted')
    ledger.record('console error: planted')
    ledger.record('console error: planted')
    expect(ledger.verdict().unexpected).toEqual(['console error: planted'])
    expect(ledger.verdict().unmet).toEqual([])
  })

  it('consumes any positive count for one-or-more and reports none', () => {
    const openEnded = createErrorLedger()
    openEnded.expect(/planted/, { times: 'one-or-more' })
    for (let index = 0; index < 3; index += 1) {
      openEnded.record('console error: planted')
    }
    expect(openEnded.verdict()).toEqual({ unexpected: [], unmet: [] })

    const empty = createErrorLedger()
    empty.expect(/planted/, { times: 'one-or-more' })
    expect(empty.verdict().unmet).toEqual(['/planted/ expected at least one, matched 0'])
  })

  it('consumes an error that arrives before its expectation', () => {
    const ledger = createErrorLedger()
    ledger.record('page error: planted')
    ledger.expect(/planted/)
    expect(ledger.verdict()).toEqual({ unexpected: [], unmet: [] })
  })

  it('consumes an error that arrives after its expectation', () => {
    const ledger = createErrorLedger()
    ledger.expect(/planted/)
    ledger.record('page error: planted')
    expect(ledger.verdict()).toEqual({ unexpected: [], unmet: [] })
  })

  it('splits past errors by pattern when several expectations arrive late', () => {
    const ledger = createErrorLedger()
    ledger.record('console error: first')
    ledger.record('console error: second')
    ledger.expect(/first/)
    ledger.expect(/second/, { times: 1 })
    expect(ledger.verdict()).toEqual({ unexpected: [], unmet: [] })
  })

  it('matches a global-flag pattern across consecutive errors', () => {
    const ledger = createErrorLedger()
    const reused = /a|b/g
    ledger.expect(reused, { times: 2 })
    // The first match moves lastIndex past the second text, so a pattern
    // carrying its own state would miss the next record.
    ledger.record('console error: a')
    ledger.record('console error: b')
    expect(ledger.verdict()).toEqual({ unexpected: [], unmet: [] })
  })

  it('strips the sticky flag the same way', () => {
    const ledger = createErrorLedger()
    ledger.expect(/planted/y)
    ledger.record('console error: planted')
    expect(ledger.verdict()).toEqual({ unexpected: [], unmet: [] })
  })

  it('refuses a count below one', () => {
    const ledger = createErrorLedger()
    expect(() => ledger.expect(/planted/, { times: 0 })).toThrow('got 0')
  })
})
