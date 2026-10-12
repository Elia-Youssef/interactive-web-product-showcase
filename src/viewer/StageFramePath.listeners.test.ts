import { describe, expect, it, vi } from 'vitest'
import { StageFramePath } from './StageFramePath'

// What a run of the presented-frame listeners does when the subscription
// set changes under it: the run covers the subscriptions it began with, so
// self removal and mid-run addition keep their defined meanings while the
// path allocates no snapshot per run.

function framePath() {
  const resume = vi.fn<() => void>()
  const retired = vi.fn<() => void>()
  return { path: new StageFramePath({ invalidate: resume, retired }), resume, retired }
}

describe('StageFramePath listeners during a run', () => {
  it('runs a listener that removes itself during a run exactly once', () => {
    const { path } = framePath()
    const calls: string[] = []
    const releaseSelf = path.listen('content', () => {
      calls.push('self')
      releaseSelf()
    })
    path.listen('content', () => calls.push('later'))

    path.runListeners()
    path.runListeners()

    expect(calls).toEqual(['self', 'later', 'later'])
  })

  it('runs a listener another listener released during the run no further, and the rest in order', () => {
    const { path } = framePath()
    const calls: string[] = []
    let releaseSecond: (() => void) | null = null
    path.listen('content', () => {
      calls.push('first')
      releaseSecond?.()
      releaseSecond = null
    })
    releaseSecond = path.listen('content', () => calls.push('second'))
    path.listen('content', () => calls.push('third'))

    path.runListeners()
    path.runListeners()

    expect(calls).toEqual(['first', 'third', 'first', 'third'])
  })

  it('runs a listener added during a run from the next run, not the one it arrived in', () => {
    const { path } = framePath()
    const calls: string[] = []
    path.listen('content', () => {
      calls.push('first')
      path.listen('content', () => calls.push('added'))
    })

    path.runListeners()
    path.runListeners()

    expect(calls).toEqual(['first', 'first', 'added'])
  })
})
