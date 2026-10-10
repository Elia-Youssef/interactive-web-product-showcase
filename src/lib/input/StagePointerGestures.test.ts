import { describe, expect, it, vi } from 'vitest'
import { StagePointerGestures } from './StagePointerGestures'

const start = { pointerId: 1, clientX: 20, clientY: 30, isPrimary: true, button: 0 }
const moved = { ...start, clientX: 21 }

function setup(card: boolean) {
  const gestures = new StagePointerGestures()
  const stage = vi.fn()
  const dismiss = vi.fn()
  const releaseFocus = gestures.focusWith(stage)
  const releaseCard = card ? gestures.consumePressWith(dismiss) : () => undefined
  return { gestures, stage, dismiss, releaseFocus, releaseCard }
}

describe('one focus decision per classified stage gesture', () => {
  it.each([true, false])(
    'a stationary press with card=%s waits, then chooses its focus owner',
    (card) => {
      const { gestures, stage, dismiss } = setup(card)
      gestures.down(start)
      gestures.move(start)
      expect(stage).not.toHaveBeenCalled()
      expect(dismiss).not.toHaveBeenCalled()
      gestures.up(start, true)
      expect(stage).toHaveBeenCalledTimes(card ? 0 : 1)
      expect(dismiss).toHaveBeenCalledTimes(card ? 1 : 0)
      gestures.up(start, true)
      expect(stage).toHaveBeenCalledTimes(card ? 0 : 1)
      expect(dismiss).toHaveBeenCalledTimes(card ? 1 : 0)
    },
  )

  it.each([true, false])(
    'a drag with card=%s commits stage focus on its first travel only',
    (card) => {
      const { gestures, stage, dismiss } = setup(card)
      gestures.down(start)
      expect(stage).not.toHaveBeenCalled()
      gestures.move(moved)
      expect(stage).toHaveBeenCalledTimes(1)
      gestures.move({ ...moved, clientY: 40 })
      gestures.move(start)
      gestures.up(start, true)
      expect(stage).toHaveBeenCalledTimes(1)
      expect(dismiss).not.toHaveBeenCalled()
    },
  )

  it('travel reported only by release is stage use and cannot dismiss', () => {
    const { gestures, stage, dismiss } = setup(true)
    gestures.down(start)
    gestures.up(moved, true)
    expect(stage).toHaveBeenCalledTimes(1)
    expect(dismiss).not.toHaveBeenCalled()
  })

  it('a release outside the owning canvas cannot consume the pending press', () => {
    const { gestures, stage, dismiss } = setup(true)
    gestures.down(start)
    gestures.up(start, false)
    expect(stage).toHaveBeenCalledTimes(1)
    expect(dismiss).not.toHaveBeenCalled()
  })

  it.each(['pending', 'drag'] as const)(
    'cancellation retires a %s gesture without a new outcome',
    (kind) => {
      const { gestures, stage, dismiss } = setup(true)
      gestures.down(start)
      if (kind === 'drag') gestures.move(moved)
      gestures.cancel(start.pointerId)
      gestures.up(start, true)
      expect(stage).toHaveBeenCalledTimes(kind === 'drag' ? 1 : 0)
      expect(dismiss).not.toHaveBeenCalled()
    },
  )

  it('another pointer cannot move, release or cancel the owning pointer', () => {
    const { gestures, stage, dismiss } = setup(true)
    gestures.down(start)
    gestures.move({ ...moved, pointerId: 2 })
    gestures.up({ ...start, pointerId: 2 }, true)
    gestures.cancel(2)
    expect(stage).not.toHaveBeenCalled()
    expect(dismiss).not.toHaveBeenCalled()
    gestures.up(start, true)
    expect(dismiss).toHaveBeenCalledTimes(1)
  })

  it.each([{ button: 1 }, { button: 2 }, { isPrimary: false }])(
    'non-dismissal pointer input %j uses the stage',
    (input) => {
      const { gestures, stage, dismiss } = setup(true)
      gestures.down({ ...start, ...input })
      gestures.up(start, true)
      expect(stage).toHaveBeenCalledTimes(1)
      expect(dismiss).not.toHaveBeenCalled()
    },
  )

  it('the live consumer at classification owns the stationary press', () => {
    const { gestures, stage, dismiss, releaseCard } = setup(true)
    gestures.down(start)
    releaseCard()
    gestures.up(start, true)
    expect(stage).toHaveBeenCalledTimes(1)
    expect(dismiss).not.toHaveBeenCalled()
  })

  it.each([true, false])(
    'a replacement consumer cannot inherit a press that began with card=%s',
    (card) => {
      const { gestures, stage, dismiss, releaseCard } = setup(card)
      gestures.down(start)
      releaseCard()
      const replacement = vi.fn()
      gestures.consumePressWith(replacement)
      gestures.up(start, true)
      expect(dismiss).not.toHaveBeenCalled()
      expect(replacement).not.toHaveBeenCalled()
      expect(stage).toHaveBeenCalledTimes(1)
    },
  )

  it('reopening a consumer with the same callback does not inherit its retired press', () => {
    const { gestures, stage, dismiss, releaseCard } = setup(true)
    gestures.down(start)
    releaseCard()
    gestures.consumePressWith(dismiss)
    gestures.up(start, true)
    expect(dismiss).not.toHaveBeenCalled()
    expect(stage).toHaveBeenCalledTimes(1)
  })

  it('canvas retirement discards its pending gesture', () => {
    const { gestures, stage, dismiss, releaseFocus } = setup(true)
    gestures.down(start)
    releaseFocus()
    gestures.up(start, true)
    expect(stage).not.toHaveBeenCalled()
    expect(dismiss).not.toHaveBeenCalled()
  })

  it('each role has one live owner and retired cleanup cannot remove a later binding', () => {
    const { gestures, stage, dismiss, releaseFocus, releaseCard } = setup(true)
    expect(() => gestures.focusWith(stage)).toThrow('one stage focus target')
    expect(() => gestures.consumePressWith(dismiss)).toThrow('one consumer')
    releaseFocus()
    releaseCard()
    gestures.focusWith(stage)
    const releaseCurrentCard = gestures.consumePressWith(dismiss)
    releaseFocus()
    releaseCard()
    gestures.down(start)
    gestures.up(start, true)
    expect(dismiss).toHaveBeenCalledTimes(1)
    expect(stage).not.toHaveBeenCalled()
    releaseCurrentCard()
    gestures.down(start)
    gestures.up(start, true)
    expect(stage).toHaveBeenCalledTimes(1)
  })
})
