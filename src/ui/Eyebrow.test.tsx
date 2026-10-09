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

// The markup with every tag and the server render's text separators gone:
// the text a reader and a screen reader get.
function textOf(html: string): string {
  return html.replace(/<!-- -->/g, '').replace(/<[^>]+>/g, '')
}

test('Eyebrow without a tail renders its copy alone in one class, as it always has', () => {
  const html = renderToString(<Eyebrow>Compact speaker</Eyebrow>)

  expect(html).toMatch(/^<p class="[^" ]+">Compact speaker<\/p>$/)
})

test.each([undefined, 2, 3, 4, 5, 6] as const)(
  'Eyebrow at level %s closes with its tail in one marked fragment after one space',
  (level) => {
    const html = renderToString(
      <Eyebrow level={level} tail="/ 001">
        Compact speaker
      </Eyebrow>,
    )

    expect(html).toMatch(/<span class="[^"]*" data-eyebrow-tail="true">\/ 001<\/span>/)
    expect(textOf(html)).toBe('Compact speaker / 001')
    expect((html.match(/data-eyebrow-tail/g) ?? []).length).toBe(1)
  },
)
