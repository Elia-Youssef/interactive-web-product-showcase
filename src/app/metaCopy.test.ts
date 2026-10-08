import { describe, expect, test } from 'vitest'
import { parseProduct } from '@lib/product'
import { manifest as fjorTast } from '@products/fjor-tast.manifest'
import { manifest as formaOne } from '@products/forma-one.manifest'
import { manifest as orsaKvern } from '@products/orsa-kvern.manifest'
import { manifest as placeholderSpeaker } from '@products/placeholder-speaker.manifest'
import { manifest as viddeSpak } from '@products/vidde-spak.manifest'
import { productMetaSet, siteMetaSet } from '@lib/copy/meta'
import { siteCopy } from '@lib/copy/site'

// The approved link-preview words of the collection, per launch product.
// The test reads the shipped manifests themselves, so a changed word in a
// manifest's meta block fails here instead of shipping in a head tag. It
// lives in the app layer because only the app layer imports the lib builder
// and the products data together.
const approved: readonly {
  readonly manifest: unknown
  readonly slug: string
  readonly title: string
  readonly description: string
  readonly socialTitle: string
  readonly alt: string
}[] = [
  {
    manifest: formaOne,
    slug: 'forma-one',
    title: 'Forma One | Product Concepts',
    description:
      'Forma One, a wireless over-ear headphone concept by Rebel Art Studios. A 40 mm driver per side, aluminum yokes and a knit band. Explore it in 3D.',
    socialTitle: 'Forma One, wireless over-ear headphones',
    alt: 'Forma One wireless over-ear headphones in Slate, assembled on a dark stage with a blueprint grid, from Product Concepts by Rebel Art Studios.',
  },
  {
    manifest: orsaKvern,
    slug: 'orsa-kvern',
    title: 'Orsa Kvern | Product Concepts',
    description:
      'Orsa Kvern, a single-dose coffee grinder concept by Rebel Art Studios. A 40 mm conical burr and forty clicks from fine to coarse. Explore it in 3D.',
    socialTitle: 'Orsa Kvern, single-dose coffee grinder',
    alt: 'Orsa Kvern single-dose coffee grinder in Brushed Steel, assembled on a dark stage with a blueprint grid, from Product Concepts by Rebel Art Studios.',
  },
  {
    manifest: viddeSpak,
    slug: 'vidde-spak',
    title: 'Vidde Spak | Product Concepts',
    description:
      'Vidde Spak, a counterweight task lamp concept by Rebel Art Studios. A steel weight keeps the arm where you leave it. Explore it in 3D.',
    socialTitle: 'Vidde Spak, counterweight task lamp',
    alt: 'Vidde Spak counterweight task lamp in Ivory, assembled on a dark stage with a blueprint grid, from Product Concepts by Rebel Art Studios.',
  },
  {
    manifest: fjorTast,
    slug: 'fjor-tast',
    title: 'Fjor Tast | Product Concepts',
    description:
      'Fjor Tast, a sixty percent keyboard concept by Rebel Art Studios. Sixty-one keys, an aluminum case and a brass weight in the base. Explore it in 3D.',
    socialTitle: 'Fjor Tast, sixty percent keyboard',
    alt: 'Fjor Tast sixty percent keyboard in Carbon, assembled on a dark stage with a blueprint grid, from Product Concepts by Rebel Art Studios.',
  },
]

describe('productMetaSet', () => {
  for (const expected of approved) {
    test(`derives the approved words for ${expected.slug}`, () => {
      expect(productMetaSet(parseProduct(expected.manifest, 'test'))).toEqual({
        title: expected.title,
        description: expected.description,
        canonicalUrl: `https://${siteCopy.siteUrl}/p/${expected.slug}`,
        socialTitle: expected.socialTitle,
        socialDescription: expected.description,
        socialImageUrl: `https://${siteCopy.siteUrl}/social/${expected.slug}.png`,
        socialImageAlt: expected.alt,
      })
    })
  }

  test('gives a product without a meta block no words of its own', () => {
    expect(productMetaSet(parseProduct(placeholderSpeaker, 'test'))).toBeNull()
  })
})

describe('siteMetaSet', () => {
  test('derives the home head set from the site copy', () => {
    expect(siteMetaSet()).toEqual({
      title: 'Product Concepts | Rebel Art Studios',
      description: siteCopy.metaDescription,
      canonicalUrl: `https://${siteCopy.siteUrl}/`,
      socialTitle: 'Product Concepts | Rebel Art Studios',
      socialDescription: siteCopy.metaDescription,
      socialImageUrl: `https://${siteCopy.siteUrl}/social/forma-one.png`,
    })
  })
})
