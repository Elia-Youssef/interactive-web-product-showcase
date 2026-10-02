import { expect, test } from 'vitest'
import { renderToString } from 'react-dom/server'
import { parseProduct } from '@lib/product'
import { siteCopy } from '@lib/copy/site'
import { StageOverlay } from '@viewer/overlay/StageOverlay'
import { HotspotAnchor } from './HotspotAnchor'

// The manifest the anchors render, validated so the component sees the real
// schema output. Two hotspots whose card copy names nothing the other's
// carries, so the card-present-only checks read the copy itself.
const manifest = parseProduct(
  {
    slug: 'anchor-test-piece',
    number: 1,
    category: 'Audio',
    brand: 'Sample',
    model: 'Piece',
    eyebrow: 'Sample piece / 001',
    tagline: 'A sample piece for the anchors.',
    intro: ['A sample piece holds the slot.'],
    finishes: [{ variant: 'sage', label: 'Sage Green', swatch: '#9DB89D' }],
    hotspots: [
      {
        id: 'driver',
        eyebrow: 'A closer look',
        title: 'Full-range driver',
        bullets: ['Set behind the grille', 'Ported through the base'],
      },
      {
        id: 'knob',
        eyebrow: 'On top',
        title: 'Volume knob',
        bullets: ['Machined aluminum'],
      },
    ],
    explode: { clip: 'Explode' },
  },
  'anchor-test-piece.test',
)

function renderAnchors(selectedId: string | null): string {
  const overlay = new StageOverlay()
  return renderToString(
    <>
      {manifest.hotspots.map((hotspot) => (
        <HotspotAnchor
          key={hotspot.id}
          overlay={overlay}
          hotspot={hotspot}
          selected={selectedId === hotspot.id}
          onToggle={() => {}}
          onClose={() => {}}
        />
      ))}
    </>,
  )
}

test('each hotspot renders one marker named by its title, none pressed while idle', () => {
  const html = renderAnchors(null)

  for (const hotspot of manifest.hotspots) {
    expect(html).toContain(`aria-label="${hotspot.title}"`)
  }
  expect(html).not.toContain('aria-pressed="true"')
  expect(html).toContain('aria-pressed="false"')
})

test('the selected hotspot renders its card with the manifest copy and the site close label', () => {
  const html = renderAnchors('driver')

  expect(html).toContain('aria-pressed="true"')
  expect(html).toContain('<h2')
  expect(html).toContain('A closer look')
  expect(html).toContain('Full-range driver')
  expect(html).toContain('Set behind the grille')
  expect(html).toContain('Ported through the base')
  expect(html).toContain(`aria-label="${siteCopy.closeLabel}"`)
})

test('the card is present only for the selected hotspot', () => {
  const html = renderAnchors('driver')

  // The knob's card copy must not appear: its marker carries only the
  // title, and this copy belongs to no marker.
  expect(html).not.toContain('On top')
  expect(html).not.toContain('Machined aluminum')
  // One card, so one title heading and one close button.
  expect((html.match(/<h2/g) ?? []).length).toBe(1)
  expect((html.match(new RegExp(`aria-label="${siteCopy.closeLabel}"`, 'g')) ?? []).length).toBe(1)
})

test('no card renders while the selection is idle', () => {
  const html = renderAnchors(null)

  expect(html).not.toContain('<h2')
  expect(html).not.toContain(`aria-label="${siteCopy.closeLabel}"`)
})
