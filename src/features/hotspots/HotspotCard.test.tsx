import { expect, test } from 'vitest'
import { renderToString } from 'react-dom/server'
import { siteCopy } from '@lib/copy/site'
import { StageOverlay } from '@viewer/overlay/StageOverlay'
import { HotspotCard } from './HotspotCard'
import { HotspotCardPresenter, type CardSlot } from './HotspotCardPresenter'

const hotspot = {
  id: 'driver',
  eyebrow: 'A closer look',
  title: 'Full-range driver',
  bullets: ['Set behind the grille', 'Ported through the base'],
}

function cardProps(slot: CardSlot) {
  const overlay = new StageOverlay()
  const neverRead = () => {
    throw new Error('the static render never decides')
  }
  const presenter = new HotspotCardPresenter(overlay, [hotspot.id], {
    layout: neverRead,
    obstacles: neverRead,
  })
  return { hotspot, slot, overlay, presenter, dock: null, onClose: () => {} } as const
}

test('the floating card renders the manifest copy and the site close label', () => {
  const html = renderToString(
    <HotspotCard {...cardProps({ hotspotId: hotspot.id, where: 'floating' })} />,
  )

  expect(html).toContain('<h2')
  expect(html).toContain(hotspot.eyebrow)
  expect(html).toContain(hotspot.title)
  for (const bullet of hotspot.bullets) {
    expect(html).toContain(bullet)
  }
  expect(html).toContain(`aria-label="${siteCopy.closeLabel}"`)
})

test('a docked card with no dock from its composition fails loudly', () => {
  const docked: CardSlot = { hotspotId: hotspot.id, where: 'docked', shown: true }
  expect(() => renderToString(<HotspotCard {...cardProps(docked)} />)).toThrow(
    'gave the markers no dock',
  )
})
