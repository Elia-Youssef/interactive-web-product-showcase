import { describe, expect, it } from 'vitest'
import { stageKeyAction, type StageKeyInput } from './keyMap'

const plain = { shiftKey: false, ctrlKey: false, altKey: false, metaKey: false }

function press(key: string, modifiers: Partial<Omit<StageKeyInput, 'key'>> = {}) {
  return stageKeyAction({ key, ...plain, ...modifiers })
}

describe('stageKeyAction', () => {
  it.each([
    ['ArrowLeft', 'left'],
    ['ArrowRight', 'right'],
    ['ArrowUp', 'up'],
    ['ArrowDown', 'down'],
  ] as const)('%s turns the product %s by the coarse step', (key, direction) => {
    expect(press(key)).toEqual({ kind: 'rotate', direction, size: 'coarse' })
  })

  it.each(['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'])(
    'Shift with %s asks for the fine step',
    (key) => {
      expect(press(key, { shiftKey: true })).toMatchObject({ kind: 'rotate', size: 'fine' })
    },
  )

  // Plus and minus by the character the key produces: the equals key's two
  // characters, the minus key's two, and the numpad's plain ones, which
  // arrive with or without Shift depending on the layout.
  it.each([
    ['+', 1, false],
    ['+', 1, true],
    ['=', 1, false],
    ['-', -1, false],
    ['_', -1, true],
  ] as const)('%s zooms by %d step (Shift %s)', (key, steps, shiftKey) => {
    expect(press(key, { shiftKey })).toEqual({ kind: 'zoom', steps })
  })

  it('Home resets', () => {
    expect(press('Home')).toEqual({ kind: 'reset' })
  })

  it.each(['ctrlKey', 'altKey', 'metaKey'] as const)(
    'answers nothing for any mapped key held with %s, the browser keeps its shortcut',
    (modifier) => {
      for (const key of [
        'ArrowLeft',
        'ArrowRight',
        'ArrowUp',
        'ArrowDown',
        '+',
        '=',
        '-',
        '_',
        'Home',
      ]) {
        expect(press(key, { [modifier]: true }), `${modifier} ${key}`).toBeNull()
      }
    },
  )

  it.each(['Tab', 'Escape', 'Enter', ' ', 'End', 'PageUp', 'a', 'constructor', 'toString'])(
    'answers nothing for the unmapped key %j',
    (key) => {
      expect(press(key)).toBeNull()
      expect(press(key, { shiftKey: true })).toBeNull()
    },
  )
})
