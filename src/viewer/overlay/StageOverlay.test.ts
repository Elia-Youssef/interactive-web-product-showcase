import { describe, expect, it } from 'vitest'
import type { OverlayElement } from './StageOverlay'
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
    })

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
    })
    overlay.pass({ width: 1, height: 1 }, () => {})
    release()
    overlay.pass({ width: 1, height: 1 }, () => {})

    expect(runs).toBe(1)
    expect(() => release()).toThrow('stale')
  })
})
