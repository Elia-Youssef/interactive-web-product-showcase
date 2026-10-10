import { describe, expect, it } from 'vitest'
import {
  applyLoadProgressEvent,
  initialLoadProgress,
  loadProgressPercent,
} from './loadProgress.logic'

// The load progress slice's pure transition: the wait turns idle, waiting,
// and idle again, the figure it holds is the whole percent the viewer
// writes, and the reveal count of the readout survives the wait it belongs
// to so the next wait's reveal is still a change.

describe('applyLoadProgressEvent', () => {
  it('starts a wait from idle, holding no figure', () => {
    expect(applyLoadProgressEvent(initialLoadProgress, { kind: 'started' })).toEqual({
      wait: { kind: 'waiting', percent: null },
      reveals: 0,
    })
  })

  it('holds the whole percent the progress event writes', () => {
    const waiting = applyLoadProgressEvent(initialLoadProgress, { kind: 'started' })

    expect(applyLoadProgressEvent(waiting, { kind: 'progress', percent: 42 })).toEqual({
      wait: { kind: 'waiting', percent: 42 },
      reveals: 0,
    })
  })

  it('drops a progress event that changes nothing', () => {
    const waiting = applyLoadProgressEvent(initialLoadProgress, { kind: 'started' })
    const stepped = applyLoadProgressEvent(waiting, { kind: 'progress', percent: 42 })

    expect(applyLoadProgressEvent(stepped, { kind: 'progress', percent: 42 })).toBe(stepped)
    expect(applyLoadProgressEvent(stepped, { kind: 'progress', percent: null })).not.toBe(stepped)
  })

  it('ignores the progress of a wait that is not running', () => {
    expect(applyLoadProgressEvent(initialLoadProgress, { kind: 'progress', percent: 42 })).toBe(
      initialLoadProgress,
    )
  })

  it('ends a wait, and keeps a second end a no-op', () => {
    const waiting = applyLoadProgressEvent(initialLoadProgress, { kind: 'started' })
    const ended = applyLoadProgressEvent(waiting, { kind: 'ended' })

    expect(ended.wait).toEqual({ kind: 'idle' })
    expect(applyLoadProgressEvent(ended, { kind: 'ended' })).toBe(ended)
  })

  it('keeps a start that changes nothing a no-op', () => {
    const waiting = applyLoadProgressEvent(initialLoadProgress, { kind: 'started' })

    expect(applyLoadProgressEvent(waiting, { kind: 'started' })).toBe(waiting)
  })

  it('counts a reveal of the readout, through the end of its wait', () => {
    const waiting = applyLoadProgressEvent(initialLoadProgress, { kind: 'started' })
    const revealed = applyLoadProgressEvent(waiting, { kind: 'revealed' })
    const ended = applyLoadProgressEvent(revealed, { kind: 'ended' })

    expect(ended).toEqual({ wait: { kind: 'idle' }, reveals: 1 })
    expect(
      applyLoadProgressEvent(applyLoadProgressEvent(ended, { kind: 'started' }), {
        kind: 'revealed',
      }),
    ).toEqual({ wait: { kind: 'waiting', percent: null }, reveals: 2 })
  })
})

describe('loadProgressPercent', () => {
  it('quantizes the fraction to the whole percent below it', () => {
    expect(loadProgressPercent(0)).toBe(0)
    expect(loadProgressPercent(0.426)).toBe(42)
    expect(loadProgressPercent(0.999)).toBe(99)
    // A whole share quantizes to the whole percent; the ledger is what
    // keeps a completed wait from showing a figure at all.
    expect(loadProgressPercent(1)).toBe(100)
  })

  it('answers null for an unknown fraction', () => {
    expect(loadProgressPercent(null)).toBeNull()
  })
})
