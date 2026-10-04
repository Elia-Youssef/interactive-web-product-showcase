import { expect, test } from 'vitest'
import { stepLabel } from './collection.logic'

test('a step label names the direction and the product it reaches', () => {
  expect(stepLabel('Previous', { brand: 'Sample', model: 'Speaker' })).toBe(
    'Previous: Sample Speaker',
  )
  expect(stepLabel('Next', { brand: 'Forma', model: 'One' })).toBe('Next: Forma One')
})
