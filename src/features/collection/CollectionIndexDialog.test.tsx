import { expect, test } from 'vitest'
import { renderToString } from 'react-dom/server'
import { EscapeProvider, type LinkProps } from '@ui/index'
import { createCollection } from '@lib/product'
import { sampleOneManifest, sampleThreeManifest, sampleTwoManifest } from '@lib/product/fixtures'
import { siteCopy } from '@lib/copy/site'
import { CollectionIndexDialog } from './CollectionIndexDialog'

// The test's stand-in for the app's link: a plain anchor with the
// contract's props, so the static render needs no router.
function FakeLink({ to, children, ...rest }: LinkProps) {
  return (
    <a href={to} {...rest}>
      {children}
    </a>
  )
}

const collection = createCollection([sampleOneManifest, sampleTwoManifest, sampleThreeManifest])

function renderDialog(currentSlug: string): string {
  return renderToString(
    <EscapeProvider>
      <CollectionIndexDialog
        open={false}
        onClose={() => {}}
        products={collection.products}
        currentSlug={currentSlug}
        link={FakeLink}
      />
    </EscapeProvider>,
  )
}

// renderToString marks the seams between adjacent text nodes with comment
// markers; replacing tags and markers with spaces leaves the text content,
// with element boundaries as the spaces between words.
function textContent(html: string): string {
  return html
    .replace(/<!--[^>]*-->/g, ' ')
    .replace(/<[^>]*>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

test('the dialog is named by its heading through aria-labelledby', () => {
  const html = renderDialog('sample-one')

  const labelledby = html.match(/<dialog [^>]*aria-labelledby="([^"]+)"/)?.[1]
  if (labelledby === undefined) {
    throw new Error('the dialog names no heading')
  }
  expect(html).toContain(`id="${labelledby}"`)
  expect(html).toContain(siteCopy.indexLabel)
})

test('the dialog lists every product in collection order with number, name and category', () => {
  const html = renderDialog('sample-one')
  const rows = [...html.matchAll(/<a [^>]*class="[^"]*row[^"]*"[^>]*>/g)].length

  expect(rows).toBe(3)
  expect(textContent(html)).toContain('01 Sample One Audio')
  expect(textContent(html)).toContain('02 Sample Two Audio')
  expect(textContent(html)).toContain('03 Sample Three Audio')
  expect(html.indexOf('/p/sample-one')).toBeLessThan(html.indexOf('/p/sample-two'))
  expect(html.indexOf('/p/sample-two')).toBeLessThan(html.indexOf('/p/sample-three'))
})

test('the open product carries the current page marker, the others none', () => {
  const html = renderDialog('sample-two')

  expect(html.match(/aria-current="page"/g)).toHaveLength(1)
  expect(html.indexOf('aria-current="page"')).toBeGreaterThan(html.indexOf('/p/sample-one'))
  expect(html.indexOf('aria-current="page"')).toBeLessThan(html.indexOf('/p/sample-three'))
})

test('the dialog carries the close button, named by the site word', () => {
  const html = renderDialog('sample-one')

  expect(html).toContain(`aria-label="${siteCopy.closeIndexLabel}"`)
  expect(html).toContain('type="button"')
})
