import { describe, expect, test } from 'vitest'
import {
  formatProductCounter,
  formatProductIndex,
  formatProductSerial,
  productEyebrow,
  productEyebrowText,
  productName,
  stepLabel,
} from './format'

// The index formatting table: single digits gain a leading zero, longer
// numbers pass through untouched.
describe('formatProductIndex', () => {
  test.each([
    { number: 1, expected: '01' },
    { number: 9, expected: '09' },
    { number: 10, expected: '10' },
    { number: 100, expected: '100' },
    { number: 1000, expected: '1000' },
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

// The serial pads to three digits, the eyebrow's own form, and longer
// numbers pass through untouched like the index.
describe('formatProductSerial', () => {
  test.each([
    { number: 1, expected: '001' },
    { number: 9, expected: '009' },
    { number: 10, expected: '010' },
    { number: 100, expected: '100' },
    { number: 1000, expected: '1000' },
  ])('formatProductSerial($number) is $expected', ({ number, expected }) => {
    expect(formatProductSerial(number)).toBe(expected)
  })
})

// The eyebrow is the manifest's kind and the tail the site composes from
// the number: the number is written once, in the number field.
describe('productEyebrow', () => {
  test.each([
    { number: 1, tail: '/ 001' },
    { number: 9, tail: '/ 009' },
    { number: 10, tail: '/ 010' },
    { number: 100, tail: '/ 100' },
    { number: 1000, tail: '/ 1000' },
  ])('product $number closes its eyebrow with $tail', ({ number, tail }) => {
    expect(productEyebrow({ eyebrow: 'Compact speaker', number })).toEqual({
      lead: 'Compact speaker',
      tail,
    })
    expect(productEyebrowText({ eyebrow: 'Compact speaker', number })).toBe(
      `Compact speaker ${tail}`,
    )
  })
})

// The product name is the brand and the model, the words the title and
// the navigation labels show.
describe('productName', () => {
  test('joins the brand and the model with one space', () => {
    expect(productName({ brand: 'Sample', model: 'Speaker' })).toBe('Sample Speaker')
  })
})

// The step label names the direction and the product it reaches.
describe('stepLabel', () => {
  test('joins the direction word and the product name', () => {
    expect(stepLabel('Previous', { brand: 'Sample', model: 'Speaker' })).toBe(
      'Previous: Sample Speaker',
    )
    expect(stepLabel('Next', { brand: 'Forma', model: 'One' })).toBe('Next: Forma One')
  })
})
