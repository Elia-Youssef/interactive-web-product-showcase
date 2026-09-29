import { expect, test } from 'vitest'
import { renderToString } from 'react-dom/server'
import { CollectionError } from '@lib/product'
import { siteCopy } from '@lib/copy/site'
import { CollectionErrorScreen } from './CollectionErrorScreen'

test('the error screen renders one alert region with the heading', () => {
  const html = renderToString(
    <CollectionErrorScreen
      error={
        new CollectionError([
          { product: null, path: null, message: 'a collection needs at least one product' },
        ])
      }
    />,
  )

  expect(html).toContain('role="alert"')
  expect(html).toContain(siteCopy.collectionErrorHeading)
})

test('the alert lists every problem with its product and path', () => {
  const html = renderToString(
    <CollectionErrorScreen
      error={
        new CollectionError([
          {
            product: 'broken-one',
            path: 'finishes[0].swatch',
            message: 'expected a hex color in #RRGGBB form',
          },
          { product: 'manifests[1]', path: 'slug', message: "duplicate slug 'broken-one'" },
        ])
      }
    />,
  )

  expect(html).toContain('broken-one')
  expect(html).toContain('finishes[0].swatch')
  expect(html).toContain('expected a hex color in #RRGGBB form')
  expect(html).toContain('manifests[1]')
  expect(html).toContain('duplicate slug')
  expect((html.match(/<li/g) ?? []).length).toBe(2)
})

test('a collection level problem renders without product or path', () => {
  const html = renderToString(
    <CollectionErrorScreen
      error={
        new CollectionError([
          { product: null, path: null, message: 'a collection needs at least one product' },
        ])
      }
    />,
  )

  expect(html).toContain('a collection needs at least one product')
})
