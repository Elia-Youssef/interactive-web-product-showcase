import { expect, test } from 'vitest'
import { renderToString } from 'react-dom/server'
import { Slider } from './Slider'
import { stopKeyAction } from './unavailable'

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

test('an unavailable Slider announces the wait and stays focusable', () => {
  const html = renderToString(<Slider {...sliderProps} unavailable />)

  expect(html).toContain('aria-disabled="true"')
  expect(html).not.toMatch(/\sdisabled[=\s/>]/)
})

test('an available Slider carries no announced wait', () => {
  const html = renderToString(<Slider {...sliderProps} />)

  expect(html).not.toContain('aria-disabled')
})

// The primitive is a plain function of its props to its element, so the
// wiring a renderer would attach is read off the element it returns: a
// waiting slider hands back no value and takes the key hold, because a
// range input moves to its keys by their default action. An available
// slider hands the value back and adds no key hold of its own.

test('an unavailable Slider ignores activation, an available one answers it', () => {
  const change = () => {}

  const waiting = Slider({ ...sliderProps, unavailable: true, onChange: change })
  expect(waiting.props.onChange).toBeUndefined()
  expect(waiting.props.onKeyDown).toBe(stopKeyAction)
  // A controlled field that answers no change handler declares itself read
  // only, so the renderer holds its warning back.
  expect(waiting.props.readOnly).toBe(true)

  const available = Slider({ ...sliderProps, onChange: change })
  expect(available.props.onChange).not.toBeUndefined()
  expect(available.props.onKeyDown).toBeUndefined()
  expect(available.props.readOnly).toBeUndefined()
})
