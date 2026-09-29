import { expect, test } from 'vitest'
import { renderToString } from 'react-dom/server'
import { IconButton } from './IconButton'
import { PlusIcon } from './icons'

test('IconButton renders a native button of type button with its aria-label', () => {
  const html = renderToString(
    <IconButton aria-label="Zoom in">
      <PlusIcon />
    </IconButton>,
  )

  expect(html).toMatch(/^<button\b/)
  expect(html).toContain('type="button"')
  expect(html).toContain('aria-label="Zoom in"')
})

test('IconButton renders its icon child', () => {
  const html = renderToString(
    <IconButton aria-label="Zoom in">
      <PlusIcon />
    </IconButton>,
  )

  expect(html).toContain('<svg')
  expect(html).toContain('stroke="currentColor"')
})

test('IconButton forwards a data attribute to the button element', () => {
  const html = renderToString(
    <IconButton aria-label="Zoom in" data-force-hover>
      <PlusIcon />
    </IconButton>,
  )

  expect(html).toContain('data-force-hover')
})
