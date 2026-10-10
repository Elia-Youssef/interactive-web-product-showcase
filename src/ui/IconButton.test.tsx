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

// The primitive is a plain function of its props to its element, so the
// wiring a renderer would attach is read off the element it returns: React
// attaches an undefined handler to nothing, so a button whose element
// carries no onClick answers no click, and click is what Enter and Space
// arrive as on a button.

test('an unavailable IconButton announces the wait and stays focusable', () => {
  const html = renderToString(
    <IconButton aria-label="Zoom in" unavailable>
      <PlusIcon />
    </IconButton>,
  )

  expect(html).toContain('aria-disabled="true"')
  expect(html).not.toMatch(/\sdisabled[=\s/>]/)
})

test('an available IconButton carries no announced wait', () => {
  const html = renderToString(
    <IconButton aria-label="Zoom in">
      <PlusIcon />
    </IconButton>,
  )

  expect(html).not.toContain('aria-disabled')
})

test('an unavailable IconButton ignores activation, an available one answers it', () => {
  const press = () => {}

  const waiting = IconButton({ 'aria-label': 'Zoom in', unavailable: true, onClick: press })
  expect(waiting.props.onClick).toBeUndefined()

  const available = IconButton({ 'aria-label': 'Zoom in', onClick: press })
  expect(available.props.onClick).toBe(press)
})
