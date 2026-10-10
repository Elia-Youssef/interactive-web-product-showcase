import { describe, expect, it } from 'vitest'
import { CommittedCard } from './CommittedCard'
import { StageOverlay } from './StageOverlay'

const bounds = { left: 10, top: 20, right: 50, bottom: 80 }
describe('committed card presentation', () => {
  it('retains an owned intent when the presenter reuses its frame scratch value', () => {
    const card = new CommittedCard()
    let shown = true
    card.mount('anchor', 'docked', () => ({ mounted: true, shown, bounds }))
    const intent = { selected: 'anchor', slot: 'docked' as const, shown: true, ready: true }
    card.intend(intent)
    card.present()
    expect(card.idle).toBe(true)
    intent.shown = false
    shown = false
    card.intend(intent)
    expect(card.idle, 'a changed reused intent still owes its own presented frame').toBe(false)
    card.present()
    expect(card.idle).toBe(true)
  })

  it('holds the intended selection through a late host commit and its presented frame', () => {
    const card = new CommittedCard()
    card.present()
    expect(card.idle).toBe(true)
    card.intend({ selected: 'next', slot: 'listed' })
    card.present()
    for (let read = 0; read < 20; read += 1) expect(card.idle).toBe(false)
    const release = card.mount('next', 'listed', () => ({ mounted: true, shown: true, bounds }))
    expect(card.idle).toBe(false)
    card.present()
    expect(card.idle).toBe(true)
    card.intend(null)
    card.present()
    expect(card.idle).toBe(false)
    release()
    expect(card.idle).toBe(false)
    card.present()
    expect(card.idle).toBe(true)
  })

  it('reads the committed dock visibility independently of its scheduled shown state', () => {
    const card = new CommittedCard()
    let shown = true
    card.mount('anchor', 'docked', () => ({ mounted: true, shown, bounds }))
    card.intend({ selected: 'anchor', slot: 'docked', shown: false })
    card.present()
    expect(card.idle).toBe(false)
    shown = false
    expect(card.idle).toBe(true)
  })
  it.each(['floating', 'docked', 'listed'] as const)(
    'reads the actual %s host and retires its geometry',
    (slot) => {
      const card = new CommittedCard()
      let shown = true
      const release = card.mount('anchor', slot, () => ({ mounted: true, shown, bounds }))
      expect(card.read()).toEqual({
        selected: 'anchor',
        slot,
        mounted: true,
        shown: true,
        bounds,
        commit: 1,
      })
      shown = false
      expect(card.read()?.shown).toBe(false)
      release()
      expect(card.read()).toBeNull()
      expect(() => release()).toThrow('stale')
      card.mount('next', slot, () => ({ mounted: true, shown, bounds }))
      expect(card.read()?.commit).toBe(3)
    },
  )

  it.each([true, false])(
    'observes actual DOM commit after presenters, observer first=%s',
    (observerFirst) => {
      let pending: (() => void) | null = null
      const overlay = new StageOverlay((present) => {
        present()
        pending?.()
        pending = null
      })
      const samples: unknown[] = []
      const observe = () => overlay.onPass(() => samples.push(overlay.card.read()), 'observer')
      const present = () =>
        overlay.onPass(() => {
          pending = () => {
            overlay.card.mount('anchor', 'docked', () => ({ mounted: true, shown: true, bounds }))
          }
        }, 'presenter')
      if (observerFirst) {
        observe()
        present()
      } else {
        present()
        observe()
      }
      overlay.pass({ width: 100, height: 100 }, () => {})
      expect(samples).toEqual([
        { selected: 'anchor', slot: 'docked', mounted: true, shown: true, bounds, commit: 1 },
      ])
      expect(overlay.presentedFrame).toBe(1)
    },
  )
})
