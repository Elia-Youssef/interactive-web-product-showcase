import { describe, expect, test } from 'vitest'
import { isInAppNavigationClick, type LinkClick } from './routeLink.logic'

const plain: LinkClick = {
  button: 0,
  ctrlKey: false,
  metaKey: false,
  shiftKey: false,
  altKey: false,
  defaultPrevented: false,
}

describe('isInAppNavigationClick', () => {
  test('a plain primary click navigates in the app', () => {
    expect(isInAppNavigationClick(plain)).toBe(true)
  })

  test.each([
    ['the control key', { ctrlKey: true }],
    ['the meta key', { metaKey: true }],
    ['the shift key', { shiftKey: true }],
    ['the alt key', { altKey: true }],
    ['the middle button', { button: 1 }],
    ['the secondary button', { button: 2 }],
    ['a click a handler already prevented', { defaultPrevented: true }],
  ])('a click with %s is left to the browser', (_, change) => {
    expect(isInAppNavigationClick({ ...plain, ...change })).toBe(false)
  })
})
