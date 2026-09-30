import { expect, test } from 'vitest'
import { renderToString } from 'react-dom/server'
import { Title } from './Title'

test('Title renders the brand on line 1 and the accented model on line 2', () => {
  const html = renderToString(<Title brand="Forma" model="One" />)

  expect(html).toMatch(/^<h1/)
  expect(html).toMatch(/<span[^>]*>Forma<\/span><span[^>]*><span[^>]*>One</)
})

test('Title closes the period inside the accent, hidden from assistive tech', () => {
  const html = renderToString(<Title brand="Forma" model="One" />)

  expect(html).toMatch(/<span[^>]*>One<span aria-hidden="true">\.<\/span><\/span>/)
  expect(html).not.toMatch(/<\/span><span aria-hidden="true">\./)
})

test('Title keeps the period out of the accessible model text', () => {
  const html = renderToString(<Title brand="Forma" model="One" />)

  expect(html).not.toMatch(/>One\.<\/span>/)
  expect(html).toContain('<span aria-hidden="true">.</span>')
})
