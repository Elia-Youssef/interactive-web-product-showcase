import { expect, test } from 'vitest'
import { renderToString } from 'react-dom/server'
import { HOTSPOT_BULLETS_MAX } from '@lib/product'
import { Card } from './Card'

const bullets = ['Neodymium motor', 'Ported rear chamber', 'Replaceable grill']

function render(overrides: Partial<{ bullets: string[]; headingLevel: 2 | 3 }> = {}) {
  return renderToString(
    <Card
      eyebrow="A closer look"
      title="40 mm full-range driver"
      bullets={overrides.bullets ?? bullets}
      onClose={() => {}}
      closeLabel="Close"
      {...(overrides.headingLevel === undefined ? {} : { headingLevel: overrides.headingLevel })}
    />,
  )
}

test('Card renders its eyebrow, title and bullets', () => {
  const html = render()

  expect(html).toContain('A closer look')
  expect(html).toContain('40 mm full-range driver')
  for (const bullet of bullets) {
    expect(html).toContain(bullet)
  }
})

test('Card renders its bullets as list items', () => {
  const html = render()

  expect(html).toContain('role="list"')
  expect((html.match(/<li/g) ?? []).length).toBe(bullets.length)
})

test('Card names its close button with the caller label', () => {
  const html = render()

  expect(html).toContain('<button type="button"')
  expect(html).toContain('aria-label="Close"')
})

test(`Card reports more than ${HOTSPOT_BULLETS_MAX} bullets as the caller error it is`, () => {
  expect(() => render({ bullets: [...bullets, 'One bullet too many'] })).toThrowError(
    new RegExp(`at most ${HOTSPOT_BULLETS_MAX} bullets, but got 4`),
  )
})

test('Card is a group named by its own title heading', () => {
  const html = render()
  const labelledBy = /role="group" aria-labelledby="([^"]+)"/.exec(html)?.[1]

  expect(labelledBy).toBeDefined()
  expect(html).toContain(`<h2 id="${labelledBy}"`)
})

test('Card titles at the heading level its caller names, h2 by default', () => {
  expect(render()).toContain('<h2')
  expect(render({ headingLevel: 3 })).toContain('<h3')
  expect(render({ headingLevel: 3 })).not.toContain('<h2')
})
