import { expect, test } from 'vitest'
import { renderToString } from 'react-dom/server'
import { ProductIndexLabel } from './ProductIndexLabel'

// renderToString marks the seams between adjacent text nodes with comment
// markers; stripping tags and markers leaves the label's text content.
function textContent(html: string): string {
  return html
    .replace(/<!--[^>]*-->/g, '')
    .replace(/<[^>]*>/g, '')
    .trim()
}

// The whole label is the contract: number, separator and category as one
// string, so a lost separator or a lost word fails. One digit and two
// digits, because the two digit padding is the formatting rule.
test.each([
  { number: 1, expected: '01 / Audio' },
  { number: 12, expected: '12 / Audio' },
])('the index label of $number reads "$expected"', ({ number, expected }) => {
  const html = renderToString(<ProductIndexLabel number={number} category="Audio" />)

  expect(textContent(html)).toBe(expected)
})
