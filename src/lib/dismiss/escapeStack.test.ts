import { expect, test } from 'vitest'
import { createEscapeStack, type EscapeLayer } from './escapeStack'

// The table drives one stack through a sequence of operations and records
// the order the layers are asked to dismiss in, so the whole class of
// orders holds: the topmost takes the key, a closed layer below waits,
// and an empty stack answers nothing.

type Operation =
  | { readonly op: 'register'; readonly layer: string }
  | { readonly op: 'unregister'; readonly layer: string }
  | { readonly op: 'dismiss'; readonly dismissed: boolean }

const cases: readonly {
  readonly name: string
  readonly operations: readonly Operation[]
  readonly dismissedInOrder: readonly string[]
}[] = [
  {
    name: 'one layer takes the dismiss and leaves with its unregister',
    operations: [
      { op: 'register', layer: 'a' },
      { op: 'dismiss', dismissed: true },
      { op: 'unregister', layer: 'a' },
      { op: 'dismiss', dismissed: false },
    ],
    dismissedInOrder: ['a'],
  },
  {
    name: 'the topmost of two takes the dismiss, the one below waits',
    operations: [
      { op: 'register', layer: 'a' },
      { op: 'register', layer: 'b' },
      { op: 'dismiss', dismissed: true },
      { op: 'unregister', layer: 'b' },
      { op: 'dismiss', dismissed: true },
    ],
    dismissedInOrder: ['b', 'a'],
  },
  {
    name: 'unregistering a non-top layer leaves the top in charge',
    operations: [
      { op: 'register', layer: 'a' },
      { op: 'register', layer: 'b' },
      { op: 'unregister', layer: 'a' },
      { op: 'dismiss', dismissed: true },
      { op: 'unregister', layer: 'b' },
      { op: 'dismiss', dismissed: false },
    ],
    dismissedInOrder: ['b'],
  },
  {
    name: 're-registering a layer moves it back to the top',
    operations: [
      { op: 'register', layer: 'a' },
      { op: 'register', layer: 'b' },
      { op: 'register', layer: 'a' },
      { op: 'dismiss', dismissed: true },
      { op: 'unregister', layer: 'a' },
      { op: 'dismiss', dismissed: true },
    ],
    dismissedInOrder: ['a', 'b'],
  },
  {
    name: 'an empty stack dismisses nothing',
    operations: [{ op: 'dismiss', dismissed: false }],
    dismissedInOrder: [],
  },
  {
    name: 'an unregister answers twice as one',
    operations: [
      { op: 'register', layer: 'a' },
      { op: 'unregister', layer: 'a' },
      { op: 'unregister', layer: 'a' },
      { op: 'dismiss', dismissed: false },
    ],
    dismissedInOrder: [],
  },
]

test.each(cases)('$name', ({ operations, dismissedInOrder }) => {
  const stack = createEscapeStack()
  // One layer object per name, so registering a name again registers the
  // same layer, the case the stack moves back to the top.
  const layers = new Map<string, EscapeLayer>()
  const unregisters = new Map<string, () => void>()
  const dismissed: string[] = []

  for (const operation of operations) {
    if (operation.op === 'register') {
      const name = operation.layer
      const layer = layers.get(name) ?? {
        dismiss: () => {
          dismissed.push(name)
        },
      }
      layers.set(name, layer)
      unregisters.set(name, stack.register(layer))
    } else if (operation.op === 'unregister') {
      unregisters.get(operation.layer)?.()
    } else {
      expect(stack.dismissTopmost()).toBe(operation.dismissed)
    }
  }

  expect(dismissed).toEqual(dismissedInOrder)
})
