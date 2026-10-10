import { expect, test } from 'vitest'
import { renderToString } from 'react-dom/server'
import { RaMark } from './RaMark'
import { raPolygon, raViewBox } from './raGeometry'
import { ambientMotion } from '@lib/motion/ambientMotion'

test('the mark is decorative and declares ambient motion without entering the tab order', () => {
  const html = renderToString(<RaMark />)
  expect(html).toContain('aria-hidden="true"')
  expect(html).toContain(`${ambientMotion.attribute}="${ambientMotion.value}"`)
  expect(html).toContain('focusable="false"')
  expect(html).not.toMatch(/tabindex|<a\b|<button\b/)
})

test('the mark renders the sweep layer and the inline polygon from the geometry', () => {
  const html = renderToString(<RaMark />)
  // The ring paint itself lives on pseudo elements of the mark and the
  // sweep, so the served markup carries the layer hosts only; the masks
  // are held to the stylesheet by the tooling guard.
  expect(html).toContain('data-ra-sweep=""')
  expect(html).toContain(`viewBox="${raViewBox}"`)
  expect(html).toContain(`points="${raPolygon}"`)
  expect(html).not.toContain('<img')
})
