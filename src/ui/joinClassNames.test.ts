import { expect, test } from 'vitest'
import { joinClassNames } from './joinClassNames'

test('joinClassNames joins both classes', () => {
  expect(joinClassNames('own', 'caller')).toBe('own caller')
})

test('joinClassNames keeps only the own class when no caller class is given', () => {
  expect(joinClassNames('own', undefined)).toBe('own')
})

test('joinClassNames passes the caller class through when the module has no class', () => {
  expect(joinClassNames(undefined, 'caller')).toBe('caller')
})
