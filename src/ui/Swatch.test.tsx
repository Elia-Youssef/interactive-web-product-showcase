import { expect, test } from 'vitest'
import { renderToString } from 'react-dom/server'
import { Swatch } from './Swatch'

test('Swatch renders a native button of type button', () => {
  const html = renderToString(<Swatch color="#9db89d" label="Sage Green" />)

  expect(html).toMatch(/^<button\b/)
  expect(html).toContain('type="button"')
})

test('Swatch names itself with the finish label', () => {
  const html = renderToString(<Swatch color="#9db89d" label="Sage Green" />)

  expect(html).toContain('aria-label="Sage Green"')
})

test('Swatch reports unselected by default and selected when selected', () => {
  const plain = renderToString(<Swatch color="#9db89d" label="Sage Green" />)
  const selected = renderToString(<Swatch color="#9db89d" label="Sage Green" selected />)

  expect(plain).toContain('aria-pressed="false"')
  expect(selected).toContain('aria-pressed="true"')
})

test('Swatch paints the finish color inline', () => {
  const html = renderToString(<Swatch color="#9db89d" label="Sage Green" />)

  expect(html).toContain('style="background-color:#9db89d"')
})
