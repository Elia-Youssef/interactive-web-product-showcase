import { expect, test } from 'vitest'
import { renderToString } from 'react-dom/server'
import { Eyebrow } from './Eyebrow'

test('Eyebrow renders its copy as given, in normal case', () => {
  const html = renderToString(<Eyebrow>Choose your finish</Eyebrow>)

  expect(html).toContain('Choose your finish')
  expect(html).not.toContain('CHOOSE YOUR FINISH')
})

test('Eyebrow without a level is the paragraph it has always been', () => {
  const html = renderToString(<Eyebrow>Choose your finish</Eyebrow>)

  expect(html).toMatch(/^<p class=/)
})

test.each([2, 3, 4, 5, 6] as const)('Eyebrow at level %i renders as that heading', (level) => {
  const html = renderToString(<Eyebrow level={level}>Choose your finish</Eyebrow>)

  expect(html).toMatch(new RegExp(`^<h${level} class=`))
  expect(html).toContain(`</h${level}>`)
})
