import { describe, expect, it } from 'vitest'
import type { OverlayElement, OverlayPassPhase } from './StageOverlay'
import { StageOverlay } from './StageOverlay'

function element(): OverlayElement {
  return { style: { visibility: '', transform: '' } }
}

describe('StageOverlay', () => {
  it('mounts an element hidden until its first placement', () => {
    const overlay = new StageOverlay()
    const el = element()

    overlay.mount('a', el, 'center')

    expect(el.style.visibility).toBe('hidden')
    expect(el.style.transform).toBe('')
  })

  it('refuses a second mount under a held key and names the key', () => {
    const overlay = new StageOverlay()
    overlay.mount('a', element(), 'center')

    expect(() => overlay.mount('a', element(), 'center')).toThrow("overlay key 'a' is already held")
  })

  it('writes a placement straight to the element style, centered on the position', () => {
    const overlay = new StageOverlay()
    const el = element()
    overlay.mount('a', el, 'center')

    overlay.place('a', { kind: 'placed', x: 12.5, y: 30.25 })

    expect(el.style.visibility).toBe('visible')
    expect(el.style.transform).toBe('translate(12.5px, 30.25px) translate(-50%, -50%)')
  })

  it('hides with visibility and never with display, so animations survive', () => {
    const overlay = new StageOverlay()
    const el = element()
    overlay.mount('a', el, 'center')
    overlay.place('a', { kind: 'placed', x: 1, y: 2 })

    overlay.place('a', { kind: 'hidden' })

    expect(el.style.visibility).toBe('hidden')
  })

  it('keeps a placement written before its element mounts and applies it at the mount', () => {
    const overlay = new StageOverlay()
    overlay.place('a', { kind: 'placed', x: 5, y: 6 })
    const el = element()

    overlay.mount('a', el, 'center')

    expect(el.style.visibility).toBe('visible')
    expect(el.style.transform).toBe('translate(5px, 6px) translate(-50%, -50%)')
  })

  it('remounts a released key at its last placement, so a remount never flashes hidden', () => {
    const overlay = new StageOverlay()
    const first = element()
    const release = overlay.mount('a', first, 'center')
    overlay.place('a', { kind: 'placed', x: 5, y: 6 })
    release()

    const second = element()
    overlay.mount('a', second, 'center')

    expect(second.style.visibility).toBe('visible')
    expect(second.style.transform).toBe('translate(5px, 6px) translate(-50%, -50%)')
  })

  it('fails a stale release loudly and leaves the later mount standing', () => {
    const overlay = new StageOverlay()
    const stale = overlay.mount('a', element(), 'center')
    stale()
    const kept = element()
    overlay.mount('a', kept, 'center')

    expect(() => stale()).toThrow('stale')
    // The later mount still takes the key's placements.
    overlay.place('a', { kind: 'placed', x: 1, y: 2 })
    expect(kept.style.transform).toBe('translate(1px, 2px) translate(-50%, -50%)')
  })

  it('places a top-left mount by its corner, with no percentage translate', () => {
    const overlay = new StageOverlay()
    const el = element()
    overlay.mount('a', el, 'top-left')

    overlay.place('a', { kind: 'placed', x: 12.5, y: 30.25 })

    expect(el.style.visibility).toBe('visible')
    expect(el.style.transform).toBe('translate(12.5px, 30.25px)')
  })

  it('runs the pass listeners once every placement of the pass is written', () => {
    const overlay = new StageOverlay()
    const seen: (string | null)[] = []
    overlay.onPass(() => {
      const a = overlay.placementOf('a')
      const b = overlay.placementOf('b')
      seen.push(`${a?.kind ?? 'none'} ${b?.kind ?? 'none'}`)
    }, 'presenter')

    overlay.pass({ width: 800, height: 600 }, (place) => {
      place('a', { kind: 'placed', x: 1, y: 2 })
      place('b', { kind: 'hidden' })
    })

    expect(seen).toEqual(['placed hidden'])
  })

  it('writes the elements of a pass like single placements', () => {
    const overlay = new StageOverlay()
    const el = element()
    overlay.mount('a', el, 'center')

    overlay.pass({ width: 800, height: 600 }, (place) => {
      place('a', { kind: 'placed', x: 3, y: 4 })
    })

    expect(el.style.visibility).toBe('visible')
    expect(el.style.transform).toBe('translate(3px, 4px) translate(-50%, -50%)')
  })

  it('keeps the last pass box and every last placement readable between passes', () => {
    const overlay = new StageOverlay()

    expect(overlay.lastPassBox()).toBeNull()
    expect(overlay.placementOf('a')).toBeNull()

    overlay.pass({ width: 800, height: 600 }, (place) => {
      place('a', { kind: 'placed', x: 3, y: 4 })
    })
    overlay.pass({ width: 400, height: 300 }, () => {})

    expect(overlay.lastPassBox()).toEqual({ width: 400, height: 300 })
    expect(overlay.placementOf('a')).toEqual({ kind: 'placed', x: 3, y: 4 })
  })

  it('reads every written placement as a record, and nothing for a key never written', () => {
    const overlay = new StageOverlay()
    overlay.mount('mounted-only', element(), 'center')
    expect(overlay.placementRecord()).toEqual({})

    overlay.pass({ width: 400, height: 300 }, (place) => {
      place('a', { kind: 'placed', x: 10, y: 20 })
      place('b', { kind: 'hidden' })
    })

    expect(overlay.placementRecord()).toEqual({
      a: { kind: 'placed', x: 10, y: 20 },
      b: { kind: 'hidden' },
    })
  })

  it('stops running a released pass listener and fails its stale release loudly', () => {
    const overlay = new StageOverlay()
    let runs = 0
    const release = overlay.onPass(() => {
      runs += 1
    }, 'observer')
    overlay.pass({ width: 1, height: 1 }, () => {})
    release()
    overlay.pass({ width: 1, height: 1 }, () => {})

    expect(runs).toBe(1)
    expect(() => release()).toThrow('stale')
  })

  // The pass order over every way the listeners can have subscribed: the
  // presenters in their subscription order, then the observers in theirs,
  // so an observer reads what every presenter placed, even one that
  // subscribed before it or subscribed again after a resize released it.
  const orderRows: readonly {
    readonly name: string
    readonly subscriptions: readonly (readonly [string, OverlayPassPhase])[]
    readonly order: readonly string[]
  }[] = [
    {
      name: 'a presenter subscribed first runs before an observer',
      subscriptions: [
        ['card', 'presenter'],
        ['probe', 'observer'],
      ],
      order: ['card', 'probe'],
    },
    {
      name: 'an observer subscribed first still runs after a presenter',
      subscriptions: [
        ['probe', 'observer'],
        ['card', 'presenter'],
      ],
      order: ['card', 'probe'],
    },
    {
      name: 'presenters and observers each keep their own subscription order',
      subscriptions: [
        ['probe-1', 'observer'],
        ['card-1', 'presenter'],
        ['probe-2', 'observer'],
        ['card-2', 'presenter'],
      ],
      order: ['card-1', 'card-2', 'probe-1', 'probe-2'],
    },
  ]

  it.each(orderRows)('$name', ({ subscriptions, order }) => {
    const overlay = new StageOverlay()
    const ran: string[] = []
    for (const [name, phase] of subscriptions) {
      overlay.onPass(() => ran.push(name), phase)
    }

    overlay.pass({ width: 1, height: 1 }, () => {})

    expect(ran).toEqual(order)
  })

  it('runs a presenter that subscribed again after an observer before that observer', () => {
    const overlay = new StageOverlay()
    const ran: string[] = []
    const releaseCard = overlay.onPass(() => ran.push('card'), 'presenter')
    overlay.onPass(() => ran.push('probe'), 'observer')
    releaseCard()
    overlay.onPass(() => ran.push('card'), 'presenter')

    overlay.pass({ width: 1, height: 1 }, () => {})

    expect(ran).toEqual(['card', 'probe'])
  })

  it('lets an observer read what a presenter placed in the same pass', () => {
    const overlay = new StageOverlay()
    const seen: string[] = []
    overlay.onPass(() => seen.push(overlay.placementOf('card')?.kind ?? 'none'), 'observer')
    overlay.onPass(() => overlay.place('card', { kind: 'placed', x: 5, y: 6 }), 'presenter')

    overlay.pass({ width: 1, height: 1 }, () => {})

    expect(seen).toEqual(['placed'])
  })

  it('takes the product records off whole, and the next content reads nothing of the last', () => {
    const overlay = new StageOverlay()
    const el = element()
    overlay.mount('hotspot:driver', el, 'center')
    overlay.place('hotspot:driver', { kind: 'placed', x: 5, y: 6 })
    // A key whose element left before the content did still holds its
    // placement: the record is the canvas side's, not the element's.
    overlay.place('hotspot:yoke', { kind: 'hidden' })

    overlay.clearProductState()

    expect(overlay.placementOf('hotspot:driver')).toBeNull()
    expect(overlay.placementOf('hotspot:yoke')).toBeNull()
    expect(overlay.placementRecord()).toEqual({})
    // The leaving content's element keeps its last applied style; the
    // clearing is the records', never a write to a gone element.
    expect(el.style.visibility).toBe('visible')
    // The next content enters clean: its first placement is read as the
    // only one.
    overlay.place('hotspot:driver', { kind: 'placed', x: 7, y: 8 })
    expect(overlay.placementRecord()).toEqual({
      'hotspot:driver': { kind: 'placed', x: 7, y: 8 },
    })
  })
})
