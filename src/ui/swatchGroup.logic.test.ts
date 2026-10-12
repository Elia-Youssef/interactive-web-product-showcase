import { describe, expect, test } from 'vitest'
import { radioKeyTarget } from './swatchGroup.logic'

describe('radioKeyTarget', () => {
  test.each([
    { name: 'ArrowRight steps on', key: 'ArrowRight', index: 0, count: 3, expected: 1 },
    { name: 'ArrowDown steps on', key: 'ArrowDown', index: 0, count: 3, expected: 1 },
    { name: 'ArrowLeft steps back', key: 'ArrowLeft', index: 2, count: 3, expected: 1 },
    { name: 'ArrowUp steps back', key: 'ArrowUp', index: 2, count: 3, expected: 1 },
    {
      name: 'ArrowRight wraps from the last to the first',
      key: 'ArrowRight',
      index: 2,
      count: 3,
      expected: 0,
    },
    {
      name: 'ArrowLeft wraps from the first to the last',
      key: 'ArrowLeft',
      index: 0,
      count: 3,
      expected: 2,
    },
    { name: 'Home jumps to the first', key: 'Home', index: 1, count: 3, expected: 0 },
    { name: 'End jumps to the last', key: 'End', index: 1, count: 3, expected: 2 },
    {
      name: 'a group of one steps onto itself',
      key: 'ArrowRight',
      index: 0,
      count: 1,
      expected: 0,
    },
  ])('$name', ({ key, index, count, expected }) => {
    expect(radioKeyTarget(key, index, count)).toBe(expected)
  })

  test.each([
    { name: 'a key the pattern does not bind', key: 'Enter', index: 1, count: 3 },
    { name: 'an empty group', key: 'ArrowRight', index: 0, count: 0 },
    { name: 'focus outside the group', key: 'ArrowRight', index: -1, count: 3 },
    { name: 'an index past the group', key: 'ArrowRight', index: 3, count: 3 },
  ])('$name moves nothing', ({ key, index, count }) => {
    expect(radioKeyTarget(key, index, count)).toBeNull()
  })
})
