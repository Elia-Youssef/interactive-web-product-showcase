import { describe, expect, test } from 'vitest'
import { parseProduct } from '@lib/product'
import { productManifests } from '@products/index'
import {
  productMetaSet,
  siteMetaSet,
  socialProductTitle,
  socialProductImageAlt,
} from '@lib/copy/meta'
import { siteCopy } from '@lib/copy/site'
import { productDocumentTitle, collectionDocumentTitle } from '@lib/routing'

// Real manifest words must reach each head slot; slot names, URL paths and
// social tag kinds stay independent assertions. The collection registers
// every shipped product, while copy edits need no expected-word edits.
describe('productMetaSet', () => {
  for (const manifest of productManifests) {
    const product = parseProduct(manifest, 'test')
    test(`propagates the owner copy to every head slot for ${product.slug}`, () => {
      const meta = product.meta
      if (meta === undefined) {
        expect(productMetaSet(product)).toBeNull()
        return
      }
      expect(productMetaSet(product)).toEqual({
        title: productDocumentTitle(product, siteCopy.collectionName),
        description: meta.description,
        canonicalUrl: `https://${siteCopy.siteUrl}/p/${product.slug}`,
        socialTitle: socialProductTitle(product, meta.kind),
        socialDescription: meta.description,
        socialImageUrl: `https://${siteCopy.siteUrl}/social/${product.slug}.png`,
        socialImageAlt: socialProductImageAlt(product, meta.kind),
        socialType: 'website',
        socialSiteName: siteCopy.studioName,
        twitterCard: 'summary_large_image',
      })
    })
  }

  test('gives a product without a meta block no words of its own', () => {
    const withoutMeta = {
      slug: 'sample-speaker',
      number: 5,
      category: 'Audio',
      brand: 'Sample',
      model: 'Speaker',
      eyebrow: 'Compact speaker',
      tagline: 'A quiet box that fills the room.',
      intro: ['One line.'],
      finishes: [{ variant: 'sage', label: 'Sage Green', swatch: '#9DB89D' }],
      hotspots: [],
      explode: { label: 'See inside' },
    }
    expect(productMetaSet(parseProduct(withoutMeta, 'test'))).toBeNull()
  })
})

describe('siteMetaSet', () => {
  test('derives the home head set from the site copy', () => {
    expect(siteMetaSet()).toEqual({
      title: collectionDocumentTitle(siteCopy.collectionName, siteCopy.studioName),
      description: siteCopy.metaDescription,
      canonicalUrl: `https://${siteCopy.siteUrl}/`,
      socialTitle: collectionDocumentTitle(siteCopy.collectionName, siteCopy.studioName),
      socialDescription: siteCopy.metaDescription,
      socialImageUrl: `https://${siteCopy.siteUrl}/social/forma-one.png`,
      socialType: 'website',
      socialSiteName: siteCopy.studioName,
      twitterCard: 'summary_large_image',
    })
  })
})
