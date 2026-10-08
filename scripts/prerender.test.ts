// The prerender's page writer, held against the real template and the real
// collection in memory: the writer and the reader of the head tags are
// pure, so this test needs no build output and passes on a tree that was
// never built. The covered product set is the one the prerender itself
// loads, derived from the shipped manifests, so a product added or removed
// needs no edit here. The files the build writes are verified where they
// are produced: the prerender reads every route file back and holds it
// against the builder, failing the build on any drift.
import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, test } from 'vitest'
import { driftedSlot, fillHead } from './headFill.ts'
import { loadMetaPages } from './metaPages.ts'
import { productMetaSet } from '../src/lib/copy/meta.ts'
import { parseProduct, type ProductInput } from '../src/lib/product/index.ts'

// The repo root of this checkout: the parent of the scripts folder.
const ROOT = fileURLToPath(new URL('..', import.meta.url))

// The real template the build step fills.
const templateHtml = await readFile(path.join(ROOT, 'index.html'), 'utf8')

// The collection as the prerender loads it: the site's own head set and
// one page per product that declares a meta block.
const { site, pages } = await loadMetaPages()

// A manifest without the meta block, the shape a product keeps when it
// declares no link-preview words of its own. The launch collection carries
// no such product, so the rule is pinned on this fixture.
const metaLessManifest = {
  slug: 'fixture-meta-less',
  number: 1,
  category: 'Audio',
  brand: 'Fixture',
  model: 'Silent',
  eyebrow: 'Fixture product / 001',
  tagline: 'A fixture without link-preview words.',
  intro: [],
  finishes: [{ variant: 'plain', label: 'Plain', swatch: '#101010' }],
  hotspots: [],
} satisfies ProductInput

describe('the page writer over the real template', () => {
  test('the template itself carries the site head set', () => {
    expect(driftedSlot(templateHtml, site)).toBeNull()
  })

  for (const page of pages) {
    test(`the writer fills the template with ${page.slug}'s head set`, () => {
      expect(driftedSlot(fillHead(templateHtml, page.set), page.set)).toBeNull()
    })
  }

  test('a product without a meta block gets no words of its own', () => {
    expect(productMetaSet(parseProduct(metaLessManifest, 'test'))).toBeNull()
  })
})
