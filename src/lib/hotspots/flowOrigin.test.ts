import { describe, expect, it } from 'vitest'
import {
  initialHotspotStatus,
  transitionHotspotFlow,
  type HotspotFlowEvent,
  type HotspotFlowTransition,
  type HotspotStatus,
} from './flow'
import { PRODUCT, listPress, listed, press, selected } from './flowFixtures'

const IDLE = initialHotspotStatus

// The selection's origin: a list item opens a hotspot exactly as its
// marker does, with the list as the origin; pressing the open hotspot from
// the other origin moves its card there and owes no move, from the same
// origin it closes; every clearing event clears a list selection too.
const originRows: readonly {
  readonly name: string
  readonly status: HotspotStatus
  readonly event: HotspotFlowEvent
  readonly expected: HotspotFlowTransition
}[] = [
  {
    name: 'a list item of a close-up hotspot while assembled enters its close-up from the list',
    status: IDLE,
    event: listPress('driver', true, true),
    expected: { status: listed('driver', true), view: 'driver' },
  },
  {
    name: 'a list item while exploded opens its card in the list with no move',
    status: IDLE,
    event: listPress('driver', true, false),
    expected: { status: listed('driver', false), view: null },
  },
  {
    name: 'a list item of a plain hotspot opens its card in the list with no move',
    status: IDLE,
    event: listPress('knob', false, true),
    expected: { status: listed('knob', false), view: null },
  },
  {
    name: 'the open list item pressed again closes its close-up and returns home',
    status: listed('driver', true),
    event: listPress('driver', true, true),
    expected: { status: IDLE, view: 'home' },
  },
  {
    name: 'the open list item of a plain card pressed again closes with no move',
    status: listed('knob', false),
    event: listPress('knob', false, true),
    expected: { status: IDLE, view: null },
  },
  {
    name: 'a marker press on the hotspot open in the list moves its card to the stage',
    status: listed('driver', true),
    event: press('driver', true, true),
    expected: { status: selected('driver', true), view: null },
  },
  {
    name: 'a list press on the hotspot open on the stage moves its card into the list',
    status: selected('knob', false),
    event: listPress('knob', false, true),
    expected: { status: listed('knob', false), view: null },
  },
  {
    name: 'a marker press on another hotspot while a list card is open opens it from the marker',
    status: listed('driver', true),
    event: press('knob', false, true),
    expected: { status: selected('knob', false), view: 'home' },
  },
  {
    name: 'a list press on another close-up while a marker card is open enters it from the list',
    status: selected('knob', false),
    event: listPress('logo', true, true),
    expected: { status: listed('logo', true), view: 'logo' },
  },
  {
    name: 'closing a list close-up returns home',
    status: listed('driver', true),
    event: { kind: 'closed', product: PRODUCT },
    expected: { status: IDLE, view: 'home' },
  },
  {
    name: 'leaving the assembled pose keeps the list card and leaves its close-up',
    status: listed('driver', true),
    event: { kind: 'disassembled', product: PRODUCT },
    expected: { status: listed('driver', false), view: 'home' },
  },
  {
    name: 'reset clears a list card and returns home',
    status: listed('knob', false),
    event: { kind: 'reset' },
    expected: { status: IDLE, view: 'home' },
  },
  {
    name: 'leaving the product clears a list card with no move',
    status: listed('driver', true),
    event: { kind: 'left', product: PRODUCT },
    expected: { status: IDLE, view: null },
  },
]

describe('transitionHotspotFlow by origin', () => {
  it.each(originRows)('$name', ({ status, event, expected }) => {
    expect(transitionHotspotFlow(status, event)).toEqual(expected)
  })
})
