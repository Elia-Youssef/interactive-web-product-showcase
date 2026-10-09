import { describe, expect, it } from 'vitest'
import type { vec3 } from '@gltf-transform/core'
import { parseProduct, type Product } from '../../src/lib/product'
import type { ProductHotspotFact, ProductHotspotFacts } from './productHotspots'
import {
  requireFollowSubjects,
  selectOcclusionSubjects,
  type OcclusionSubject,
} from './occlusionSubjects'

// The selection of the marker occlusion proof's subjects, over fake
// products and fake hotspot facts: per product, the hotspot whose anchor
// lies inside the occluder bounds with a hiding height, every such anchor
// considered, or no subject, and the set-level guard that fails when the
// whole set offers none. The products are validated through the manifest
// schema, so the selection reads the real product shape.

// A fake product carrying one hotspot per given id, each with words unique
// to its id so the assertions read the subjects' own copy.
function fakeProduct(slug: string, hotspotIds: readonly string[]): Product {
  return parseProduct(
    {
      slug,
      number: 1,
      category: 'Audio',
      brand: 'Fake',
      model: 'Piece',
      eyebrow: slug,
      tagline: `A fake piece for the occlusion selection proof of ${slug}.`,
      intro: [],
      finishes: [{ variant: 'sage', label: 'Sage Green', swatch: '#9db89d' }],
      hotspots: hotspotIds.map((id) => ({
        id,
        eyebrow: 'A closer look',
        title: `the ${id} title`,
        bullets: [`the ${id} bullet`],
      })),
    },
    `${slug}.test`,
  )
}

// A fake anchor: inside says whether its position lies inside the occluder
// bounds, and the hiding height is what the facts found for it.
function fakeFact(id: string, inside: boolean, hidingHeightM: number | null): ProductHotspotFact {
  const stagePosition: vec3 = inside ? [0.1, 0, 0] : [1.5, 0, 0]
  return { id, stagePosition, hidingHeightM }
}

// The fake facts of one product: one anchor per entry, in the given order,
// over occluder bounds the fake anchors sit in or out of.
function fakeFacts(hotspots: readonly ProductHotspotFact[]): ProductHotspotFacts {
  return {
    hotspots,
    occluderBounds: { min: [-0.5, -0.5, -0.5], max: [0.5, 0.5, 0.5] },
    occluders: [],
  }
}

describe('selectOcclusionSubjects', () => {
  it('picks another inside anchor when the first inside anchor has no hiding height', () => {
    const product = fakeProduct('mixed-piece', ['out_a', 'in_b', 'in_c'])
    const facts = fakeFacts([
      fakeFact('out_a', false, 0.3),
      fakeFact('in_b', true, null),
      fakeFact('in_c', true, 0.12),
    ])

    const subjects = selectOcclusionSubjects([product], new Map([[product.slug, facts]]))

    const subject = subjects.get('mixed-piece')
    expect(subject?.product).toBe(product)
    expect(subject?.hotspot.id).toBe('in_c')
    expect(subject?.hotspot.title).toBe('the in_c title')
    expect(subject?.hidingHeightM).toBe(0.12)
    expect(subject?.anchor).toEqual({ x: 0.1, y: 0, z: 0 })
  })

  it('answers no subject when the inside anchors have no hiding height', () => {
    const bare = fakeProduct('bare-piece', ['in_a', 'in_b'])
    const hiding = fakeProduct('hiding-piece', ['in_h'])
    const factsBySlug = new Map([
      [bare.slug, fakeFacts([fakeFact('in_a', true, null), fakeFact('in_b', true, null)])],
      [hiding.slug, fakeFacts([fakeFact('in_h', true, 0.2)])],
    ])

    const subjects = selectOcclusionSubjects([bare, hiding], factsBySlug)

    expect(subjects.get('bare-piece')).toBeUndefined()
    expect(subjects.get('hiding-piece')?.hotspot.id).toBe('in_h')
  })

  it('answers no subject when the only hiding height stands outside the body', () => {
    const open = fakeProduct('open-piece', ['out_a'])
    const hiding = fakeProduct('hiding-piece', ['in_h'])
    const factsBySlug = new Map([
      [open.slug, fakeFacts([fakeFact('out_a', false, 0.3)])],
      [hiding.slug, fakeFacts([fakeFact('in_h', true, 0.25)])],
    ])

    const subjects = selectOcclusionSubjects([open, hiding], factsBySlug)

    expect(subjects.get('open-piece')).toBeUndefined()
    expect(subjects.get('hiding-piece')?.hotspot.id).toBe('in_h')
  })

  it('selects the set per product: a product without a subject is no error', () => {
    const withSubject = fakeProduct('hiding-piece', ['in_a'])
    const withoutSubject = fakeProduct('open-piece', ['out_b'])
    const factsBySlug = new Map([
      [withSubject.slug, fakeFacts([fakeFact('in_a', true, 0.2)])],
      [withoutSubject.slug, fakeFacts([fakeFact('out_b', false, null)])],
    ])

    const subjects = selectOcclusionSubjects([withSubject, withoutSubject], factsBySlug)

    expect([...subjects.keys()]).toEqual(['hiding-piece'])
    expect(subjects.get('hiding-piece')?.hotspot.id).toBe('in_a')
  })

  it('gives every subject a numeric hiding height', () => {
    const first = fakeProduct('first-piece', ['in_a'])
    const second = fakeProduct('second-piece', ['in_b', 'in_c'])
    const factsBySlug = new Map([
      [first.slug, fakeFacts([fakeFact('in_a', true, 0.15)])],
      [second.slug, fakeFacts([fakeFact('in_b', true, null), fakeFact('in_c', true, -0.05)])],
    ])

    const subjects = selectOcclusionSubjects([first, second], factsBySlug)

    for (const subject of subjects.values()) {
      expect(typeof subject.hidingHeightM, `${subject.hotspot.id} carries a number`).toBe('number')
    }
    expect(subjects.get('second-piece')?.hidingHeightM).toBe(-0.05)
  })

  it('fails naming the missing subject when no product of the set offers one', () => {
    const first = fakeProduct('bare-piece', ['in_a'])
    const second = fakeProduct('also-bare', ['out_b'])
    const factsBySlug = new Map([
      [first.slug, fakeFacts([fakeFact('in_a', true, null)])],
      [second.slug, fakeFacts([fakeFact('out_b', false, 0.4)])],
    ])

    expect(() => selectOcclusionSubjects([first, second], factsBySlug)).toThrow(
      /no occludable hotspot with a hiding height/,
    )
  })

  it('fails naming the product when its hotspot facts are missing', () => {
    const product = fakeProduct('unfactured', ['in_a'])

    expect(() => selectOcclusionSubjects([product], new Map())).toThrow(/unfactured/)
  })
})

describe('requireFollowSubjects', () => {
  const subjectOf = (slug: string): OcclusionSubject => {
    const product = fakeProduct(slug, ['hidden'])
    const hotspot = product.hotspots[0]
    if (hotspot === undefined) {
      throw new Error(`the fake ${slug} carries no hotspot`)
    }
    return { product, hotspot, anchor: { x: 0, y: 0, z: 0 }, hidingHeightM: 0.1 }
  }

  it('keeps only the products with both a plain hotspot and an occlusion subject', () => {
    const subjects = new Map([
      ['both', subjectOf('both')],
      ['no-plain', subjectOf('no-plain')],
    ])
    const slugs = requireFollowSubjects(
      [
        { slug: 'both', hasPlainHotspot: true },
        { slug: 'no-plain', hasPlainHotspot: false },
        { slug: 'no-subject', hasPlainHotspot: true },
      ],
      subjects,
    )
    expect([...slugs]).toEqual(['both'])
  })

  it('fails naming what is missing when no product carries both halves', () => {
    const subjects = new Map([['no-plain', subjectOf('no-plain')]])
    expect(() =>
      requireFollowSubjects(
        [
          { slug: 'no-plain', hasPlainHotspot: false },
          { slug: 'no-subject', hasPlainHotspot: true },
        ],
        subjects,
      ),
    ).toThrow('no product with both a plain hotspot and an occlusion subject')
  })
})
