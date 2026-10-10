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

test('both ring layers share one mask class and the inline polygon comes from the geometry', () => {
  const html = renderToString(<RaMark />)
  const rings = [...html.matchAll(/class="([^"]+)" data-ra-ring="(white|red)"/g)]
  expect(rings).toHaveLength(2)
  expect(rings[0]?.[1]).toBe(rings[1]?.[1])
  expect(html).toContain(`viewBox="${raViewBox}"`)
  expect(html).toContain(`points="${raPolygon}"`)
  expect(html).not.toContain('<img')
})
