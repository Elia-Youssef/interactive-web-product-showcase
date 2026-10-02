import { expect, test } from 'vitest'
import { renderToString } from 'react-dom/server'
import { Slider } from './Slider'

// The rendered contract of the primitive: a native range input, named,
// announcing the caller's value text, and disabled as told. The onChange
// hand-back of a number is the browser's own contract of valueAsNumber,
// exercised through the real input by the e2e suite.

const sliderProps = {
  'aria-label': 'Exploded view',
  value: 0.5,
  step: 0.01,
  valueText: '50%',
  onChange: () => {},
}

test('Slider renders a native range input over the unit interval', () => {
  const html = renderToString(<Slider {...sliderProps} />)

  expect(html).toMatch(/^<input\b/)
  expect(html).toContain('type="range"')
  expect(html).toContain('min="0"')
  expect(html).toContain('max="1"')
})

test('Slider renders the caller value at the caller step', () => {
  const html = renderToString(<Slider {...sliderProps} />)

  expect(html).toContain('step="0.01"')
  expect(html).toContain('value="0.5"')
})

test('the accessible name is the caller label', () => {
  const html = renderToString(<Slider {...sliderProps} />)

  expect(html).toContain('aria-label="Exploded view"')
})

test('the value text is what assistive tech announces', () => {
  const html = renderToString(<Slider {...sliderProps} />)

  expect(html).toContain('aria-valuetext="50%"')
})

test('the filled fraction rides on the input as the stylesheet input', () => {
  const html = renderToString(<Slider {...sliderProps} />)

  expect(html).toContain('--slider-fill:50%')
})

test('disabled renders the native disabled attribute', () => {
  const html = renderToString(<Slider {...sliderProps} disabled />)

  expect(html).toContain('disabled')
})

test('without disabled the input stays enabled', () => {
  const html = renderToString(<Slider {...sliderProps} />)

  expect(html).not.toContain('disabled')
})
