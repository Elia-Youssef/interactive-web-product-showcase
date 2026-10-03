import { expect, test } from 'vitest'
import { renderToString } from 'react-dom/server'
import { parseProduct } from '@lib/product'
import { StageOverlay } from '@viewer/overlay/StageOverlay'
import { HotspotAnchor } from './HotspotAnchor'

// The manifest the anchors render, validated so the component sees the real
// schema output.
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

test('the selected hotspot marker is pressed and no anchor carries a card', () => {
  const html = renderAnchors('driver')

  expect((html.match(/aria-pressed="true"/g) ?? []).length).toBe(1)
  // The card has a presenter of its own: an anchor holds its marker only.
  expect(html).not.toContain('<h2')
  expect(html).not.toContain('A closer look')
})
