// The head writer's and drift check's contract: every owned slot is filled
// with its value, the template's own shape (attribute order, line breaks)
// survives, the structural tags pass through, a missing slot fails
// loudly, and a value that carries markup cannot break out of its
// attribute. The drift check reads a filled head back per tag and finds
// nothing, and reports the first tag that parts from its value.
import { describe, expect, test } from 'vitest'
import { driftedSlot, fillHead } from './headFill.ts'

// The template's shape mirrors the built index.html, the wrapped
// description meta included.
const TEMPLATE = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <link rel="icon" href="data:," />
    <title>Product Concepts | Rebel Art Studios</title>
    <meta
      name="description"
      content="site description"
    />
    <link rel="canonical" href="https://rebelartstudios.org/" />
    <meta property="og:type" content="website" />
    <meta property="og:site_name" content="Rebel Art Studios" />
    <meta property="og:title" content="site title" />
    <meta
      property="og:description"
      content="site description"
    />
    <meta property="og:url" content="https://rebelartstudios.org/" />
    <meta property="og:image" content="https://rebelartstudios.org/social/forma-one.png" />
    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:title" content="site title" />
    <meta name="twitter:description" content="site description" />
    <meta name="twitter:image" content="https://rebelartstudios.org/social/forma-one.png" />
  </head>
</html>
`

const VALUES = {
  title: 'Forma One | Product Concepts',
  description: 'Forma One, a headphone concept. Explore it in 3D.',
  canonicalUrl: 'https://rebelartstudios.org/p/forma-one',
  socialTitle: 'Forma One, wireless over-ear headphones',
  socialDescription: 'Forma One, a headphone concept. Explore it in 3D.',
  socialImageUrl: 'https://rebelartstudios.org/social/forma-one.png',
  socialType: 'product',
  socialSiteName: 'Example Studio',
  twitterCard: 'summary',
}

describe('fillHead', () => {
  test('fills every owned slot and keeps the template shape', () => {
    const filled = fillHead(TEMPLATE, VALUES)
    expect(filled).toContain('<title>Forma One | Product Concepts</title>')
    expect(filled).toContain(
      'name="description"\n      content="Forma One, a headphone concept. Explore it in 3D."',
    )
    expect(filled).toContain(
      '<link rel="canonical" href="https://rebelartstudios.org/p/forma-one" />',
    )
    expect(filled).toContain(
      '<meta property="og:title" content="Forma One, wireless over-ear headphones" />',
    )
    expect(filled).toContain(
      '<meta property="og:url" content="https://rebelartstudios.org/p/forma-one" />',
    )
    expect(filled).toContain(
      '<meta name="twitter:title" content="Forma One, wireless over-ear headphones" />',
    )
    expect(filled).toContain(
      '<meta name="twitter:image" content="https://rebelartstudios.org/social/forma-one.png" />',
    )
    expect(filled).toContain('<meta property="og:type" content="product" />')
    expect(filled).toContain('<meta property="og:site_name" content="Example Studio" />')
    expect(filled).toContain('<meta name="twitter:card" content="summary" />')
    // The wrapped shapes keep their line breaks.
    expect(filled).toMatch(/<meta\n\s+name="description"\n\s+content="/)
    expect(filled).toMatch(/<meta\n\s+property="og:description"\n\s+content="/)
  })

  test('leaves the tags the template owns untouched', () => {
    const filled = fillHead(TEMPLATE, VALUES)
    expect(filled).toContain('<meta charset="UTF-8" />')
    expect(filled).toContain('<link rel="icon" href="data:," />')
  })

  test('fills twice with the same values to the same text', () => {
    const once = fillHead(TEMPLATE, VALUES)
    expect(fillHead(once, VALUES)).toBe(once)
  })

  test('escapes a value that carries markup characters', () => {
    const filled = fillHead(TEMPLATE, {
      ...VALUES,
      title: 'A & B <C> "D"',
    })
    expect(filled).toContain('<title>A &amp; B &lt;C&gt; &quot;D&quot;</title>')
  })

  test('names the slot a template without it lacks', () => {
    const withoutCanonical = TEMPLATE.replace(/\s*<link rel="canonical"[^>]*>/, '')
    expect(() => fillHead(withoutCanonical, VALUES)).toThrow('the canonical link')
  })
})

describe('driftedSlot', () => {
  test('finds nothing in a head the writer just filled', () => {
    expect(driftedSlot(fillHead(TEMPLATE, VALUES), VALUES)).toBeNull()
  })

  test('finds nothing in a head that already carries its values', () => {
    expect(
      driftedSlot(TEMPLATE, {
        title: 'Product Concepts | Rebel Art Studios',
        description: 'site description',
        canonicalUrl: 'https://rebelartstudios.org/',
        socialTitle: 'site title',
        socialDescription: 'site description',
        socialImageUrl: 'https://rebelartstudios.org/social/forma-one.png',
        socialType: 'website',
        socialSiteName: 'Rebel Art Studios',
        twitterCard: 'summary_large_image',
      }),
    ).toBeNull()
  })

  test('reports a tag whose content parts from its value, decoded against the escaped text', () => {
    const written = fillHead(TEMPLATE, VALUES)
    const drifted = written.replace(
      '<meta property="og:title" content="Forma One, wireless over-ear headphones" />',
      '<meta property="og:title" content="another product entirely" />',
    )
    expect(driftedSlot(drifted, VALUES)).toBe('the og:title meta does not match the builder')
  })

  test('decodes the entities the writer escaped before comparing', () => {
    const escaped = { ...VALUES, title: 'A & B <C> "D"' }
    expect(driftedSlot(fillHead(TEMPLATE, escaped), escaped)).toBeNull()
  })

  test('names the slot a head without it lacks', () => {
    const templateValues = {
      title: 'Product Concepts | Rebel Art Studios',
      description: 'site description',
      canonicalUrl: 'https://rebelartstudios.org/',
      socialTitle: 'site title',
      socialDescription: 'site description',
      socialImageUrl: 'https://rebelartstudios.org/social/forma-one.png',
      socialType: 'website',
      socialSiteName: 'Rebel Art Studios',
      twitterCard: 'summary_large_image',
    }
    const withoutTwitterImage = TEMPLATE.replace(/\s*<meta name="twitter:image"[^>]*>/, '')
    expect(driftedSlot(withoutTwitterImage, templateValues)).toBe(
      'the twitter:image meta is missing',
    )
  })
})
