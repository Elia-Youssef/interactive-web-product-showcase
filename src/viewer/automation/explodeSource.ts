import type { ViewerExplode } from './viewerAutomation'

// The live reading of the one mounted explode feature, as the automation
// hook serves it. The feature hands up a function that reads the scene and
// its spring at access time, so the hook holds no copy that can go stale:
// exactly how every other field of window.__viewer reads the real thing.

// The reading itself: null while no explode feature is mounted on the
// owner, which is the state before the product loads and after it leaves.
export type ExplodeReading = () => ViewerExplode | null

// The readings, keyed by the one object both ends of the registration
// reach: the app store. The bridge sits outside the canvas and the feature
// inside it, so a React context between them does not exist; the store is
// the app-wide channel they already share, and keying on it keeps the
// registry scoped to what one store can present. A second feature that
// tries to register over a live one fails loudly, so two stages cannot
// silently take the contract over.
const readings = new WeakMap<object, ExplodeReading>()

export function setExplodeReading(owner: object, reading: ExplodeReading): void {
  if (readings.has(owner)) {
    throw new Error('an explode reading is already registered for this owner')
  }
  readings.set(owner, reading)
}

// The identity guard keeps a stale cleanup of an unmounted feature from
// clearing the reading a later feature installed.
export function clearExplodeReading(owner: object, reading: ExplodeReading): void {
  if (readings.get(owner) !== reading) {
    throw new Error('a stale explode reading cannot clear the one its owner holds now')
  }
  readings.delete(owner)
}

export function readExplode(owner: object): ViewerExplode | null {
  const reading = readings.get(owner)
  return reading === undefined ? null : reading()
}
