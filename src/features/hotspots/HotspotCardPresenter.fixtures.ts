import type { CardDockPolicy } from '@lib/hotspots/cardPresentation'
import type { StageRect } from '@lib/hotspots/markerBox'
import type { CardLayout } from '@lib/hotspots/cardLayout'
import { StageOverlay, type OverlayElement } from '@viewer/overlay/StageOverlay'
import { CARD_OVERLAY_KEY, overlayKey } from '@lib/hotspots/hotspotKeys'
import { HotspotCardPresenter } from './HotspotCardPresenter'

const metrics = { markerHitPx: 44, cardOffsetPx: 8, focusOutsetPx: 5 }
export const card = { width: 200, height: 100 }

export function setup(
  policy: { current: CardDockPolicy } = { current: 'when-crowded' },
  chrome: { current: readonly StageRect[] } = { current: [] },
) {
  const overlay = new StageOverlay()
  const reads = { count: 0 }
  const layout = (): CardLayout => {
    reads.count += 1
    return { policy: policy.current, metrics }
  }
  const presenter = new HotspotCardPresenter(overlay, ['driver', 'knob'], {
    layout,
    obstacles: () => chrome.current,
  })
  const element: OverlayElement = { style: { visibility: '', transform: '' } }
  overlay.mount(CARD_OVERLAY_KEY, element, 'top-left')
  let publishes = 0
  presenter.subscribe(() => {
    publishes += 1
  })
  return { overlay, presenter, element, publishes: () => publishes, reads: () => reads.count }
}

export function pass(
  overlay: StageOverlay,
  stage: { width: number; height: number },
  markers: Readonly<Record<string, { x: number; y: number } | null>>,
) {
  overlay.pass(stage, (place) => {
    for (const [id, point] of Object.entries(markers)) {
      place(overlayKey(id), point === null ? { kind: 'hidden' } : { kind: 'placed', ...point })
    }
  })
}
