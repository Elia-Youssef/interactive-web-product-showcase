// The flow tests' statuses and presses: one product and another, a
// selection and a press, from a marker unless the caller names the list.
import type { HotspotFlowEvent, HotspotOrigin, HotspotStatus } from './flow'

export const PRODUCT = 'sample-one'
export const OTHER = 'sample-two'

export function selected(
  hotspot: string,
  closeUp: boolean,
  product = PRODUCT,
  origin: HotspotOrigin = 'marker',
): HotspotStatus {
  return { kind: 'selected', product, hotspot, closeUp, origin }
}

export function press(
  hotspot: string,
  hasCloseUp: boolean,
  assembled: boolean,
  product = PRODUCT,
  origin: HotspotOrigin = 'marker',
): HotspotFlowEvent {
  return { kind: 'pressed', product, hotspot, hasCloseUp, assembled, origin }
}

export const listPress = (hotspot: string, hasCloseUp: boolean, assembled: boolean) =>
  press(hotspot, hasCloseUp, assembled, PRODUCT, 'list')

export const listed = (hotspot: string, closeUp: boolean) =>
  selected(hotspot, closeUp, PRODUCT, 'list')
