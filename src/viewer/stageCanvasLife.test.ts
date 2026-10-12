import { expect, test } from 'vitest'
import {
  applyStageCanvasEvent,
  initialStageCanvasLife,
  type StageCanvasEvent,
  type StageCanvasLife,
} from './stageCanvasLife'

type Row = {
  readonly name: string
  readonly from: StageCanvasLife
  readonly event: StageCanvasEvent
  readonly expected: StageCanvasLife
}

const retired = (epoch: number): StageCanvasLife => ({ epoch, renderer: 'retired' })
const live = (epoch: number): StageCanvasLife => ({ epoch, renderer: 'live' })

const table: Row[] = [
  {
    name: 'a live canvas keeps its mount when content arrives',
    from: live(0),
    event: { kind: 'content-arrived' },
    expected: live(0),
  },
  {
    name: 'the retirement of the mounted canvas retires it, on the same mount',
    from: live(0),
    event: { kind: 'retired', epoch: 0 },
    expected: retired(0),
  },
  {
    name: 'content arriving on a retired canvas gets one fresh, live canvas',
    from: retired(0),
    event: { kind: 'content-arrived' },
    expected: live(1),
  },
  {
    name: 'the retirement of a canvas already replaced changes nothing',
    from: live(1),
    event: { kind: 'retired', epoch: 0 },
    expected: live(1),
  },
]

test.each(table)('$name', ({ from, event, expected }) => {
  expect(applyStageCanvasEvent(from, event)).toEqual(expected)
})

test('a retired canvas stays retired, with the failed content on it, until content arrives', () => {
  const life = applyStageCanvasEvent(initialStageCanvasLife, { kind: 'retired', epoch: 0 })
  expect(applyStageCanvasEvent(life, { kind: 'retired', epoch: 0 })).toEqual(retired(0))
})

test('one arrival moves the epoch once: a second arrival on the fresh canvas keeps it', () => {
  const retiredLife = applyStageCanvasEvent(initialStageCanvasLife, { kind: 'retired', epoch: 0 })
  const fresh = applyStageCanvasEvent(retiredLife, { kind: 'content-arrived' })
  expect(applyStageCanvasEvent(fresh, { kind: 'content-arrived' })).toEqual(fresh)
})
