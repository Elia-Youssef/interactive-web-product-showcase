import { expect, test } from 'vitest'
import { renderToString } from 'react-dom/server'
import { Marker } from './Marker'

function render(overrides: Partial<{ label: string; active: boolean }> = {}) {
  return renderToString(
    <Marker label={overrides.label ?? 'Volume knob'} active={overrides.active ?? false} />,
  )
}

test('Marker renders a real button named by its label', () => {
  const html = render()

  expect(html).toContain('<button type="button"')
  expect(html).toContain('aria-label="Volume knob"')
})

test('Marker carries its active state as the pressed state', () => {
  expect(render()).toContain('aria-pressed="false"')
  expect(render({ active: true })).toContain('aria-pressed="true"')
})

test('Marker renders no text of its own: the label is the name', () => {
  const html = render()

  // Every tag stripped, nothing readable is left: the marker's job is the
  // point it marks, and its words live in the accessible name.
  expect(html.replace(/<[^>]*>/g, '').trim()).toBe('')
})
