import { describe, expect, it, vi } from 'vitest'
import { StageRetiredError } from '../../src/viewer/StageRetiredError'
import { consoleErrorText, pageErrorText } from './errorMessages.ts'

function consoleMessage(values: readonly unknown[], text: string) {
  return {
    args: () =>
      values.map((value) => ({
        evaluate: async (render: (value: unknown) => string) => render(value),
      })),
    text: vi.fn(() => text),
  }
}

const retired = new StageRetiredError('retired')

describe('portable console error messages', () => {
  for (const { engine, text } of [
    { engine: 'Chrome', text: `${retired}\n    at a frame` },
    { engine: 'Firefox', text: 'Error' },
    { engine: 'WebKit', text: String(retired) },
  ]) {
    it(`reads the page Error itself instead of the ${engine} rendering`, async () => {
      const message = consoleMessage([retired], text)
      expect(await consoleErrorText(message)).toBe(`${retired.name}: ${retired.message}`)
      expect(message.text).not.toHaveBeenCalled()
    })
  }

  it('reads a page-logged string from the argument', async () => {
    const message = consoleMessage(['a deliberate error'], 'a different engine rendering')
    expect(await consoleErrorText(message)).toBe('a deliberate error')
    expect(message.text).not.toHaveBeenCalled()
  })

  it('joins all arguments in their logged order with their string values', async () => {
    const message = consoleMessage(['cause', retired, 42, false, null, undefined, {}], 'Error')
    expect(await consoleErrorText(message)).toBe(
      `cause ${retired.name}: ${retired.message} 42 false null undefined [object Object]`,
    )
    expect(message.text).not.toHaveBeenCalled()
  })

  it('retains the only content of an argument-less browser message', async () => {
    const text = 'Failed to load resource: net::ERR_FAILED'
    const message = consoleMessage([], text)
    expect(await consoleErrorText(message)).toBe(text)
    expect(message.text).toHaveBeenCalledOnce()
  })

  it('rejects an argument evaluation failure without replacing it with engine text', async () => {
    const cause = new Error('the argument could not be read')
    const message = {
      args: () => [{ evaluate: () => Promise.reject(cause) }],
      text: vi.fn(() => 'Error'),
    }
    await expect(consoleErrorText(message)).rejects.toBe(cause)
    expect(message.text).not.toHaveBeenCalled()
  })
})

describe('portable page error messages', () => {
  const shapes = [
    { engine: 'Chrome', name: retired.name, message: retired.message },
    { engine: 'Firefox', name: retired.name, message: retired.message },
    { engine: 'WebKit rejection', name: 'Unhandled Promise Rejection', message: String(retired) },
  ]

  for (const shape of shapes) {
    it(`records the raised name and message from the ${shape.engine} shape`, () => {
      expect(pageErrorText(shape)).toBe(`${retired.name}: ${retired.message}`)
    })
  }

  it('keeps colons inside the original rejection message', () => {
    expect(
      pageErrorText({ name: 'Unhandled Promise Rejection', message: 'TypeError: cause: detail' }),
    ).toBe('TypeError: cause: detail')
  })

  it('keeps a wrapper whose message has no original name separator', () => {
    expect(
      pageErrorText({ name: 'Unhandled Promise Rejection', message: 'a rejected string' }),
    ).toBe('Unhandled Promise Rejection: a rejected string')
  })

  it('keeps the name of a normal error whose message looks like another error', () => {
    expect(pageErrorText({ name: 'TypeError', message: 'RangeError: invalid value' })).toBe(
      'TypeError: RangeError: invalid value',
    )
  })

  it('keeps an empty message', () => {
    expect(pageErrorText({ name: 'TypeError', message: '' })).toBe('TypeError: ')
    expect(pageErrorText({ name: 'Unhandled Promise Rejection', message: 'TypeError: ' })).toBe(
      'TypeError: ',
    )
  })
})
