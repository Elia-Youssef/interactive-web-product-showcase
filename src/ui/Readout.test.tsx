import { expect, test } from 'vitest'
import { renderToString } from 'react-dom/server'
import { Readout } from './Readout'

test('Readout renders its string exactly as given', () => {
  const html = renderToString(<Readout>127 / 360</Readout>)

  expect(html).toContain('127 / 360')
})

test('Readout never reformats the value it is given', () => {
  const html = renderToString(<Readout>007 / 360</Readout>)

  expect(html).toContain('>007 / 360</span>')
  expect(html).not.toContain('>7 / 360<')
})
