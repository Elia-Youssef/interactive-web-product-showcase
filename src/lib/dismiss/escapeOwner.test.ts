import { describe, expect, it } from 'vitest'
import type { EscapeLayer } from './escapeStack'
import { createEscapeOwner, type EscapeKeyEvent, type KeyTarget } from './escapeOwner'

// The escape owner of one document: the stack of open layers plus the one
// keydown listener their presence installs. Everything here drives the
// owner through a counting target and plain events, so the listener
// lifecycle is the thing observed, not the DOM.

// A keydown target that counts its listeners and lets the test press keys.
function countingTarget(): {
  readonly target: () => KeyTarget
  readonly installs: () => number
  readonly press: (key: string) => void
} {
  const listeners = new Set<(event: EscapeKeyEvent) => void>()
  return {
    target: () => ({
      addEventListener: (_type: 'keydown', listener: (event: EscapeKeyEvent) => void) => {
        listeners.add(listener)
      },
      removeEventListener: (_type: 'keydown', listener: (event: EscapeKeyEvent) => void) => {
        listeners.delete(listener)
      },
    }),
    installs: () => listeners.size,
    press: (key: string) => {
      for (const listener of [...listeners]) {
        listener(Object.assign(new Event('keydown'), { key }))
      }
    },
  }
}

function layer(name: string, dismissed: string[]): EscapeLayer {
  return { dismiss: () => dismissed.push(name) }
}

describe('createEscapeOwner', () => {
  it('installs no listener before the first layer, one for it, none after it leaves', () => {
    const observed = countingTarget()
    const owner = createEscapeOwner(observed.target)
    expect(observed.installs()).toBe(0)

    const unregister = owner.register(layer('card', []))
    expect(observed.installs()).toBe(1)

    unregister()
    expect(observed.installs()).toBe(0)
  })

  it('never holds more than one listener for many layers', () => {
    const observed = countingTarget()
    const owner = createEscapeOwner(observed.target)

    const first = owner.register(layer('card', []))
    owner.register(layer('index', []))
    owner.register(layer('sheet', []))
    expect(observed.installs()).toBe(1)

    first()
    expect(observed.installs()).toBe(1)
  })

  it('keeps one listener and the layer live through the StrictMode replay', () => {
    const observed = countingTarget()
    const owner = createEscapeOwner(observed.target)
    const dismissed: string[] = []

    const register = () => owner.register(layer('card', dismissed))
    const unregister = register()
    unregister()
    const reregister = register()

    expect(observed.installs()).toBe(1)
    observed.press('Escape')
    expect(dismissed).toEqual(['card'])
    reregister()
  })

  it('an unregister called twice never underflows', () => {
    const observed = countingTarget()
    const owner = createEscapeOwner(observed.target)
    const dismissed: string[] = []

    const unregister = owner.register(layer('card', dismissed))
    unregister()
    unregister()
    expect(observed.installs()).toBe(0)

    const again = owner.register(layer('card', dismissed))
    expect(observed.installs()).toBe(1)
    again()
  })

  it('hands Escape to the topmost layer only, then to the next after it leaves', () => {
    const observed = countingTarget()
    const owner = createEscapeOwner(observed.target)
    const dismissed: string[] = []

    // A real layer's dismiss closes it, which unregisters it: the dismiss
    // below closes through its own unregister, the way the hook's effect
    // does when the open flag falls.
    const closeOf = (unregister: () => void, name: string): EscapeLayer => ({
      dismiss: () => {
        dismissed.push(name)
        unregister()
      },
    })
    let unregisterIndex: () => void = () => undefined
    const unregisterCard = owner.register(closeOf(() => unregisterCard(), 'card'))
    unregisterIndex = owner.register(closeOf(() => unregisterIndex(), 'index'))

    observed.press('Enter')
    observed.press('a')
    expect(dismissed).toEqual([])

    observed.press('Escape')
    expect(dismissed).toEqual(['index'])

    observed.press('Escape')
    expect(dismissed).toEqual(['index', 'card'])
    expect(observed.installs()).toBe(0)
  })

  it('two owners on two targets are independent', () => {
    const first = countingTarget()
    const second = countingTarget()
    const dismissed: string[] = []
    const firstOwner = createEscapeOwner(first.target)
    const secondOwner = createEscapeOwner(second.target)

    const unregisterFirst = firstOwner.register(layer('card', dismissed))
    secondOwner.register(layer('index', dismissed))

    expect(first.installs()).toBe(1)
    expect(second.installs()).toBe(1)

    second.press('Escape')
    expect(dismissed).toEqual(['index'])
    first.press('Escape')
    expect(dismissed).toEqual(['index', 'card'])

    unregisterFirst()
    expect(first.installs()).toBe(0)
    expect(second.installs()).toBe(1)
  })

  it('reads the target once for a whole open and close, never at construction', () => {
    let reads = 0
    const target = () => {
      reads += 1
      return {
        addEventListener: () => undefined,
        removeEventListener: () => undefined,
      }
    }
    const owner = createEscapeOwner(target)
    expect(reads).toBe(0)

    const unregister = owner.register(layer('card', []))
    const unregisterAgain = owner.register(layer('index', []))
    expect(reads).toBe(1)

    unregisterAgain()
    unregister()
    expect(reads).toBe(1)
  })
})
