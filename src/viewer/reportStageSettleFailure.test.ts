import { afterEach, describe, expect, it, vi } from 'vitest'
import { ResourceHolds } from '@lib/async/resourceHolds'
import { FrameClock } from './FrameClock'
import { StageSettle } from './StageSettle'
import { StageRetiredError } from './StageRetiredError'
import { reportStageSettleFailure } from './reportStageSettleFailure'

function pendingSettle() {
  const clock = new FrameClock()
  const life = clock.createFrameLife()
  let started: () => void = () => {}
  const pending = new Promise<void>((resolve) => {
    started = resolve
  })
  const step = new StageSettle(life).settle({ invalidate: () => started() })
  return { clock, life, pending, step }
}

describe('stage settle failure reporting', () => {
  afterEach(() => vi.restoreAllMocks())

  it.each(['dispose', 'retire'] as const)(
    'ends a pending settle on %s, quietly only for disposal',
    async (end) => {
      const error = vi.spyOn(console, 'error').mockImplementation(() => {})
      const settle = pendingSettle()
      const handled = settle.step.catch(reportStageSettleFailure)
      await settle.pending
      settle.life[end]()
      await expect(handled).resolves.toBeUndefined()
      const reason = await settle.life.onceFrame().catch((cause: unknown) => cause)
      expect(reason).toBeInstanceOf(StageRetiredError)
      if (end === 'dispose') {
        expect(error).not.toHaveBeenCalled()
      } else {
        expect(error).toHaveBeenCalledExactlyOnceWith(reason)
      }
    },
  )

  it.each(['disposed', 'retired'] as const)(
    'applies the same %s rule to a caller-owned failure channel',
    (reason) => {
      const report = vi.fn()
      const cause = new StageRetiredError(reason)
      reportStageSettleFailure(cause, report)
      if (reason === 'disposed') {
        expect(report).not.toHaveBeenCalled()
      } else {
        expect(report).toHaveBeenCalledExactlyOnceWith(cause)
      }
    },
  )

  it('keeps an ordinary failure loud even when its message matches disposal', () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {})
    const cause = new Error(new StageRetiredError('disposed').message)
    reportStageSettleFailure(cause)
    expect(error).toHaveBeenCalledExactlyOnceWith(cause)
  })

  it('an effect replay keeps pending work live, and its final release ends quietly', async () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {})
    const flush: (() => void)[] = []
    const holds = new ResourceHolds<object>((release) => flush.push(release))
    const settle = pendingSettle()
    const handled = settle.step.catch(reportStageSettleFailure)
    let ended = false
    void handled.then(() => {
      ended = true
    })
    await settle.pending
    holds.hold(settle.clock)
    holds.drop(settle.clock, settle.clock.dispose)
    holds.hold(settle.clock)
    flush.splice(0).forEach((release) => release())
    await Promise.resolve()
    expect(ended).toBe(false)
    holds.drop(settle.clock, settle.clock.dispose)
    flush.splice(0).forEach((release) => release())
    await handled
    expect(ended).toBe(true)
    await expect(settle.clock.onceFrame()).rejects.toMatchObject({ reason: 'disposed' })
    expect(error).not.toHaveBeenCalled()
  })
})
