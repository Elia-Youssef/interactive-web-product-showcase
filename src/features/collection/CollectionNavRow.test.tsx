import { expect, test } from 'vitest'
import { renderToString } from 'react-dom/server'
import type { LinkProps } from '@ui/index'
import { createCollection } from '@lib/product'
import { sampleOneManifest, sampleThreeManifest, sampleTwoManifest } from '@lib/product/fixtures'
import { siteCopy } from '@lib/copy/site'
import { CollectionNavRow } from './CollectionNavRow'

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

function renderRow(slug: string): string {
  const product = collection.bySlug(slug)
  if (product === undefined) {
    throw new Error(`the fixture collection holds no '${slug}'`)
  }
  return renderToString(
    <CollectionNavRow product={product} collection={collection} link={FakeLink} />,
  )
}

test('the row reads the wrapped neighbors and the counter from the collection', () => {
  const html = renderRow('sample-one')

  expect(html).toContain('aria-label="Previous: Sample Three"')
  expect(html).toContain('href="/p/sample-three"')
  expect(html).toContain('aria-label="Next: Sample Two"')
  expect(html).toContain('href="/p/sample-two"')
})

test('the counter is the index trigger, closed until it opens', () => {
  const html = renderRow('sample-two')

  expect(html).toContain('02 / 03')
  expect(html).toContain('aria-haspopup="dialog"')
  expect(html).toContain('aria-expanded="false"')
  expect(html).toContain(`aria-label="${siteCopy.openIndexLabel}"`)
})

test('the row is a navigation landmark named by the index word', () => {
  const html = renderRow('sample-one')

  expect(html).toContain(`<nav class="`)
  expect(html).toContain(`aria-label="${siteCopy.indexLabel}"`)
})
