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

test('Swatch reports unchecked by default and checked when checked', () => {
  const plain = renderToString(<Swatch color="#9db89d" label="Sage Green" />)
  const checked = renderToString(<Swatch color="#9db89d" label="Sage Green" checked />)

  expect(plain).toContain('aria-checked="false"')
  expect(checked).toContain('aria-checked="true"')
})

test('Swatch is a radio of a single-choice group', () => {
  const html = renderToString(<Swatch color="#9db89d" label="Sage Green" />)

  expect(html).toContain('role="radio"')
})

test('Swatch paints the finish color inline', () => {
  const html = renderToString(<Swatch color="#9db89d" label="Sage Green" />)

  expect(html).toContain('style="background-color:#9db89d"')
})
