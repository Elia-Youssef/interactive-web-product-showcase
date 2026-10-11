import { describe, expect, it } from 'vitest'
import { renderToString } from 'react-dom/server'
import { parseProduct } from '@lib/product'
import { sampleOneManifest, sampleTwoManifest } from '@lib/product/fixtures'
import { highlightsLabel } from '@lib/copy/productPanel'
import { siteCopy } from '@lib/copy/site'
import { HighlightsSection, type HighlightsSectionProps } from './HighlightsList'

// The Highlights section from plain values, at each state: closed means
// absent, open lists one item per manifest hotspot in manifest order, the
// items wait disabled until the product is presented, the item whose card
// is open says so, and a product with no hotspots renders no section. A
// static render reads no store, so the state is the input.

const product = parseProduct(sampleOneManifest, 'sample-one')
const noOp = () => {}

function render(overrides: Partial<HighlightsSectionProps> = {}): string {
  return renderToString(
    <HighlightsSection
      product={product}
      expanded={false}
      presented
      open={null}
      onToggle={noOp}
      onPress={noOp}
      onListHost={noOp}
      {...overrides}
    />,
  )
}

// The item buttons in render order, with their attributes.
function items(html: string): { readonly title: string; readonly tag: string }[] {
  return [...html.matchAll(/<li[^>]*>(<button[^>]*>)([^<]*)<\/button>/g)].map((match) => ({
    tag: match[1] ?? '',
    title: match[2] ?? '',
  }))
}

describe('the Highlights section', () => {
  it('is named with its hotspot count, as an h2 section heading', () => {
    const html = render()
    expect(highlightsLabel(product.hotspots.length)).toBe(
      `${siteCopy.highlightsHeading} (${product.hotspots.length})`,
    )
    // The label is copy, and copy may hold regex metacharacters: it is
    // escaped before it anchors the heading's own button in the markup.
    const label = highlightsLabel(product.hotspots.length).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    expect(html).toMatch(new RegExp(`<h2[^>]*><button[^>]*>${label}<`))
  })

  it('renders closed as its button alone: no list, nothing a marker locator could meet', () => {
    const html = render()
    expect(html).toContain('aria-expanded="false"')
    expect(items(html)).toEqual([])
    for (const hotspot of product.hotspots) {
      expect(html).not.toContain(hotspot.title)
    }
  })

  it('lists one item per manifest hotspot, in manifest order, once open', () => {
    const listed = items(render({ expanded: true }))
    expect(listed.map((item) => item.title)).toEqual(product.hotspots.map((h) => h.title))
    for (const item of listed) {
      expect(item.tag).toContain('aria-expanded="false"')
      expect(item.tag).not.toContain('disabled')
    }
  })

  it.each([
    product,
    parseProduct(
      {
        ...sampleOneManifest,
        hotspots: Array.from({ length: 12 }, (_, index) => ({
          id: `point_${index}`,
          title: `Feature ${index}`,
          eyebrow: 'Detail',
          bullets: [`Detail ${index}`],
        })),
      },
      'sample-one',
    ),
  ])(
    'keeps the complete manifest order while every item waits disabled: $hotspots.length items',
    (waitingProduct) => {
      const waiting = items(render({ product: waitingProduct, expanded: true, presented: false }))
      expect(waiting).toHaveLength(waitingProduct.hotspots.length)
      expect(waiting.map((item) => item.title)).toEqual(
        waitingProduct.hotspots.map((hotspot) => hotspot.title),
      )
      for (const item of waiting) {
        expect(item.tag).toContain('disabled=""')
      }
    },
  )

  it('marks the item whose card is open from the list, naming its card host', () => {
    const html = render({ expanded: true, open: 'shell' })
    const [driver, shell] = items(html)
    expect(driver?.tag).toContain('aria-expanded="false"')
    expect(driver?.tag).not.toContain('aria-controls')
    expect(shell?.tag).toContain('aria-expanded="true"')
    const host = /aria-controls="([^"]+)"/.exec(shell?.tag ?? '')?.[1]
    expect(host).toBeDefined()
    expect(html).toContain(`id="${host}"`)
  })

  it('renders no section for a product with no hotspots', () => {
    const bare = parseProduct(sampleTwoManifest, 'sample-two')
    expect(render({ product: bare, expanded: true })).toBe('')
  })
})
