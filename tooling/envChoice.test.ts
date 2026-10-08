import { describe, expect, it } from 'vitest'
import { resolveEnvChoice } from './envChoice.ts'

const setting = { variable: 'VIEWER_TEST_CHOICE', default: 'a', choices: ['a', 'b'] } as const

describe('resolveEnvChoice', () => {
  it('returns the default when the variable is unset', () => {
    expect(resolveEnvChoice(setting, {})).toBe('a')
  })

  it('accepts every listed choice', () => {
    for (const choice of setting.choices) {
      expect(resolveEnvChoice(setting, { VIEWER_TEST_CHOICE: choice })).toBe(choice)
    }
  })

  it('names the variable, the choices and the raw value on a mistake', () => {
    expect(() => resolveEnvChoice(setting, { VIEWER_TEST_CHOICE: 'c' })).toThrow(
      'VIEWER_TEST_CHOICE must be one of a, b, but got "c"',
    )
  })

  it('rejects an empty value instead of falling back', () => {
    expect(() => resolveEnvChoice(setting, { VIEWER_TEST_CHOICE: '' })).toThrow('but got ""')
  })
})
