import { describe, expect, it } from 'vitest'
import {
  initialHotspotStatus,
  transitionHotspotFlow,
  type HotspotFlowEvent,
  type HotspotFlowTransition,
  type HotspotStatus,
} from './flow'

// The flow table: every event from every kind of status, with and without
// a close-up, assembled and exploded. 'driver' and 'logo' stand for any
// hotspots with a close-up, 'knob' and 'switch' for any without one; both
// products carry a 'driver' hotspot.

const PRODUCT = 'sample-one'
const OTHER = 'sample-two'

function selected(hotspot: string, closeUp: boolean, product = PRODUCT): HotspotStatus {
  return { kind: 'selected', product, hotspot, closeUp }
}

function press(
  hotspot: string,
  hasCloseUp: boolean,
  assembled: boolean,
  product = PRODUCT,
): HotspotFlowEvent {
  return { kind: 'pressed', product, hotspot, hasCloseUp, assembled }
}

const IDLE = initialHotspotStatus

const rows: readonly {
  readonly name: string
  readonly status: HotspotStatus
  readonly event: HotspotFlowEvent
  readonly expected: HotspotFlowTransition
}[] = [
  {
    name: 'pressing a close-up marker while assembled enters its close-up',
    status: IDLE,
    event: press('driver', true, true),
    expected: { status: selected('driver', true), view: 'driver' },
  },
  {
    name: 'pressing a close-up marker while exploded opens its card with no move',
    status: IDLE,
    event: press('driver', true, false),
    expected: { status: selected('driver', false), view: null },
  },
  {
    name: 'pressing a plain marker while assembled opens its card with no move',
    status: IDLE,
    event: press('knob', false, true),
    expected: { status: selected('knob', false), view: null },
  },
  {
    name: 'pressing a plain marker while exploded opens its card with no move',
    status: IDLE,
    event: press('knob', false, false),
    expected: { status: selected('knob', false), view: null },
  },
  {
    name: 'switching from a close-up to a plain hotspot returns home',
    status: selected('driver', true),
    event: press('knob', false, true),
    expected: { status: selected('knob', false), view: 'home' },
  },
  {
    name: 'switching between two close-ups while assembled moves straight to the new one',
    status: selected('driver', true),
    event: press('logo', true, true),
    expected: { status: selected('logo', true), view: 'logo' },
  },
  {
    name: 'switching from a close-up to a close-up hotspot while exploded returns home once',
    status: selected('driver', true),
    event: press('logo', true, false),
    expected: { status: selected('logo', false), view: 'home' },
  },
  {
    name: 'switching from a plain hotspot to a close-up while assembled enters it',
    status: selected('knob', false),
    event: press('driver', true, true),
    expected: { status: selected('driver', true), view: 'driver' },
  },
  {
    name: 'switching from a card opened while exploded to a close-up while exploded makes no move',
    status: selected('driver', false),
    event: press('logo', true, false),
    expected: { status: selected('logo', false), view: null },
  },
  {
    name: 'switching between two plain hotspots makes no move',
    status: selected('knob', false),
    event: press('switch', false, true),
    expected: { status: selected('switch', false), view: null },
  },
  {
    name: 'pressing the active marker of a close-up closes and returns home',
    status: selected('driver', true),
    event: press('driver', true, true),
    expected: { status: IDLE, view: 'home' },
  },
  {
    name: 'pressing the active marker of a card opened while exploded closes with no move',
    status: selected('driver', false),
    event: press('driver', true, false),
    expected: { status: IDLE, view: null },
  },
  {
    name: 'closing a close-up returns home',
    status: selected('driver', true),
    event: { kind: 'closed', product: PRODUCT },
    expected: { status: IDLE, view: 'home' },
  },
  {
    name: 'closing a plain card makes no move',
    status: selected('knob', false),
    event: { kind: 'closed', product: PRODUCT },
    expected: { status: IDLE, view: null },
  },
  {
    name: 'closing with no selection changes nothing',
    status: IDLE,
    event: { kind: 'closed', product: PRODUCT },
    expected: { status: IDLE, view: null },
  },
  {
    name: 'leaving the assembled pose in a close-up returns home and keeps the card',
    status: selected('driver', true),
    event: { kind: 'disassembled', product: PRODUCT },
    expected: { status: selected('driver', false), view: 'home' },
  },
  {
    name: 'leaving the assembled pose with a plain card keeps it with no move',
    status: selected('knob', false),
    event: { kind: 'disassembled', product: PRODUCT },
    expected: { status: selected('knob', false), view: null },
  },
  {
    name: 'leaving the assembled pose with no selection changes nothing',
    status: IDLE,
    event: { kind: 'disassembled', product: PRODUCT },
    expected: { status: IDLE, view: null },
  },
  {
    name: 'reset from a close-up clears the card and returns home',
    status: selected('driver', true),
    event: { kind: 'reset' },
    expected: { status: IDLE, view: 'home' },
  },
  {
    name: 'reset from a plain card clears it and returns home',
    status: selected('knob', false),
    event: { kind: 'reset' },
    expected: { status: IDLE, view: 'home' },
  },
  {
    name: 'reset with no selection returns home',
    status: IDLE,
    event: { kind: 'reset' },
    expected: { status: IDLE, view: 'home' },
  },
  {
    name: 'leaving the product clears its close-up with no move',
    status: selected('driver', true),
    event: { kind: 'left', product: PRODUCT },
    expected: { status: IDLE, view: null },
  },
  {
    name: 'leaving the product with no selection changes nothing',
    status: IDLE,
    event: { kind: 'left', product: PRODUCT },
    expected: { status: IDLE, view: null },
  },
  {
    name: "another product's press of the same id opens it there, owing nothing for this close-up",
    status: selected('driver', true, OTHER),
    event: press('driver', false, true),
    expected: { status: selected('driver', false), view: null },
  },
  {
    name: "another product's press of a close-up enters it there",
    status: selected('driver', true, OTHER),
    event: press('driver', true, true),
    expected: { status: selected('driver', true), view: 'driver' },
  },
  {
    name: "another product's close leaves this close-up alone",
    status: selected('driver', true, OTHER),
    event: { kind: 'closed', product: PRODUCT },
    expected: { status: selected('driver', true, OTHER), view: null },
  },
  {
    name: "another product's explode leaves this close-up alone",
    status: selected('driver', true, OTHER),
    event: { kind: 'disassembled', product: PRODUCT },
    expected: { status: selected('driver', true, OTHER), view: null },
  },
  {
    name: "another product's leave keeps this selection",
    status: selected('driver', true, OTHER),
    event: { kind: 'left', product: PRODUCT },
    expected: { status: selected('driver', true, OTHER), view: null },
  },
]

describe('transitionHotspotFlow', () => {
  it.each(rows)('$name', ({ status, event, expected }) => {
    expect(transitionHotspotFlow(status, event)).toEqual(expected)
  })

  it('answers the very status it was given for every step that changes nothing', () => {
    const plain = selected('knob', false)
    const others = selected('driver', true, OTHER)
    const unchanged: readonly (readonly [HotspotStatus, HotspotFlowEvent])[] = [
      [IDLE, { kind: 'closed', product: PRODUCT }],
      [IDLE, { kind: 'disassembled', product: PRODUCT }],
      [IDLE, { kind: 'left', product: PRODUCT }],
      [plain, { kind: 'disassembled', product: PRODUCT }],
      [others, { kind: 'closed', product: PRODUCT }],
      [others, { kind: 'disassembled', product: PRODUCT }],
      [others, { kind: 'left', product: PRODUCT }],
    ]
    for (const [status, event] of unchanged) {
      expect(transitionHotspotFlow(status, event)).toEqual({ status, view: null })
      expect(transitionHotspotFlow(status, event).status).toBe(status)
    }
  })
})
