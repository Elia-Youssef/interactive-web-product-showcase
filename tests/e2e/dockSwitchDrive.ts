import type { Page } from '@playwright/test'
import type { HotspotFlow } from './hotspotFlowFacts'
import type { SwitchPair } from './flowSubjects'
import type { DockProductSelection } from './dockFlowSelection'
import { expect } from './fixtures'
import { switchMarkerView } from './switchMarkerView'
import { markerOf, requireCamera } from './hotspotViews'
import { expectOrbitAtRest, stageAspectOfCanvas } from './stageCamera'

export async function exposeDockSwitchTarget(
  page: Page,
  flow: HotspotFlow,
  pair: SwitchPair,
  read: DockProductSelection,
): Promise<void> {
  if (!read.zoomedSwitchSources.has(pair.from.id)) return
  const view = await switchMarkerView(page, flow.subject.product, (shown) => shown.has(pair.to.id))
  expect(
    view.shown.has(pair.to.id),
    'the selected switch target is re-exposed by visitor zoom controls',
  ).toBe(true)
  await markerOf(page, pair.to.title).click({ trial: true })
}

export async function expectDockSwitchCamera(
  page: Page,
  flow: HotspotFlow,
  pair: SwitchPair,
): Promise<void> {
  const view = flow.subject.viewOf(pair.to.id)
  const aspect = await stageAspectOfCanvas(page)
  const expected = view === null ? flow.homeAt(aspect) : flow.viewAt(view, aspect)
  expectOrbitAtRest(await requireCamera(page), expected, `switch to ${pair.to.title}`)
}
