import { expect, test } from 'vitest'
import { renderToString } from 'react-dom/server'
import { Eyebrow } from './Eyebrow'

test('Eyebrow renders its copy as given, in normal case', () => {
  const html = renderToString(<Eyebrow>Choose your finish</Eyebrow>)

  expect(html).toContain('Choose your finish')
  expect(html).not.toContain('CHOOSE YOUR FINISH')
})
