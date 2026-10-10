// The stage's key map as data: which key, with which modifiers, asks the
// stage for what. The arrows turn the product (Shift for the fine step),
// plus and minus zoom, Home returns to the home view. Keys are read by
// their produced character (event.key), never by their position, so plus
// and minus work on every keyboard layout and on the numpad. A key held
// with Ctrl, Alt or Meta is never the stage's: those are the browser's own
// shortcuts (page zoom, history), so the map answers nothing for them and
// the caller leaves the event alone.

import type { OrbitDirection, OrbitStepSize } from './orbitStep'

export type StageKeyAction =
  | { readonly kind: 'rotate'; readonly direction: OrbitDirection; readonly size: OrbitStepSize }
  | { readonly kind: 'zoom'; readonly steps: 1 | -1 }
  | { readonly kind: 'reset' }

// The parts of a keyboard event the map reads.
export type StageKeyInput = {
  readonly key: string
  readonly shiftKey: boolean
  readonly ctrlKey: boolean
  readonly altKey: boolean
  readonly metaKey: boolean
}

const directionKeys: ReadonlyMap<string, OrbitDirection> = new Map<string, OrbitDirection>([
  ['ArrowLeft', 'left'],
  ['ArrowRight', 'right'],
  ['ArrowUp', 'up'],
  ['ArrowDown', 'down'],
])

// Plus is Shift plus the equals key on many layouts, and minus shares its
// key with the underscore, so both characters of each key count; the
// numpad produces the plain characters.
const zoomKeys: ReadonlyMap<string, 1 | -1> = new Map<string, 1 | -1>([
  ['+', 1],
  ['=', 1],
  ['-', -1],
  ['_', -1],
])

const resetKeys: ReadonlySet<string> = new Set(['Home'])

export function stageKeyAction(input: StageKeyInput): StageKeyAction | null {
  if (input.ctrlKey || input.altKey || input.metaKey) {
    return null
  }
  const direction = directionKeys.get(input.key)
  if (direction !== undefined) {
    return { kind: 'rotate', direction, size: input.shiftKey ? 'fine' : 'coarse' }
  }
  const steps = zoomKeys.get(input.key)
  if (steps !== undefined) {
    return { kind: 'zoom', steps }
  }
  return resetKeys.has(input.key) ? { kind: 'reset' } : null
}
