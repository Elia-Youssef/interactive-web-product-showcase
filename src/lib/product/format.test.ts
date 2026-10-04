import { describe, expect, test } from 'vitest'
import { formatProductCounter, formatProductIndex, productName } from './format'

// The index formatting table: single digits gain a leading zero, longer
// numbers pass through untouched.
describe('formatProductIndex', () => {
  test.each([
    { number: 1, expected: '01' },
    { number: 9, expected: '09' },
    { number: 10, expected: '10' },
    { number: 100, expected: '100' },
  ])('formatProductIndex($number) is $expected', ({ number, expected }) => {
    expect(formatProductIndex(number)).toBe(expected)
  })
})

// The counter joins the product's position and the collection count
// through the one index formatting, so both sides pad the same way.
describe('formatProductCounter', () => {
  test.each([
    { number: 1, count: 2, expected: '01 / 02' },
    { number: 2, count: 2, expected: '02 / 02' },
    { number: 11, count: 104, expected: '11 / 104' },
  ])('formatProductCounter($number, $count) is $expected', ({ number, count, expected }) => {
    expect(formatProductCounter(number, count)).toBe(expected)
  })
})

// The product name is the brand and the model, the words the title and
// the navigation labels show.
describe('productName', () => {
  test('joins the brand and the model with one space', () => {
    expect(productName({ brand: 'Sample', model: 'Speaker' })).toBe('Sample Speaker')
  })
})
