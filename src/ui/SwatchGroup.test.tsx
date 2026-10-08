import { expect, test } from 'vitest'
import { renderToString } from 'react-dom/server'
import { SwatchGroup } from './SwatchGroup'

const items = [
  { key: 'graphite', color: '#2b2e2c', label: 'Graphite', checked: false },
  { key: 'sage', color: '#9db89d', label: 'Sage Green', checked: true },
  { key: 'oak', color: '#8a6a4f', label: 'Oak', checked: false },
]

function renderGroup(): string {
  return renderToString(
    <SwatchGroup label="Choose your finish" items={items} onSelect={() => {}} />,
  )
}

test('the group is a radiogroup named by its label', () => {
  const html = renderGroup()

  expect(html).toContain('role="radiogroup"')
  expect(html).toContain('aria-label="Choose your finish"')
})

test('every member is a radio named by its finish', () => {
  const html = renderGroup()

  expect((html.match(/role="radio"/g) ?? []).length).toBe(items.length)
  for (const item of items) {
    expect(html).toContain(`aria-label="${item.label}"`)
  }
})

// The one rendered member named by the label, as its own markup chunk:
// attribute order in the static render is not the test's to know.
function buttonOf(html: string, label: string): string {
  const chunks = html.split('<button').filter((chunk) => chunk.includes(`aria-label="${label}"`))
  expect(chunks, `one member named ${label}`).toHaveLength(1)
  return chunks[0] ?? ''
}

test('the checked state sits on exactly the checked radio', () => {
  const html = renderGroup()

  expect((html.match(/aria-checked="true"/g) ?? []).length).toBe(1)
  expect(buttonOf(html, 'Sage Green')).toContain('aria-checked="true"')
  expect(buttonOf(html, 'Graphite')).toContain('aria-checked="false"')
  expect(buttonOf(html, 'Oak')).toContain('aria-checked="false"')
})

test('the checked radio is the group one tab stop', () => {
  const html = renderGroup()

  // Roving tabindex: the checked member carries the tab, the rest skip it,
  // so one Tab lands on the choice the visitor last made.
  expect((html.match(/tabindex="0"/g) ?? []).length).toBe(1)
  expect((html.match(/tabindex="-1"/g) ?? []).length).toBe(items.length - 1)
  expect(buttonOf(html, 'Sage Green')).toContain('tabindex="0"')
  expect(buttonOf(html, 'Graphite')).toContain('tabindex="-1"')
  expect(buttonOf(html, 'Oak')).toContain('tabindex="-1"')
})

test('every swatch paints its own finish color inline', () => {
  const html = renderGroup()

  for (const item of items) {
    expect(html).toContain(`background-color:${item.color}`)
  }
})
