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

    overlay.mount('a', el)

    expect(el.style.visibility).toBe('hidden')
    expect(el.style.transform).toBe('')
  })

  it('refuses a second mount under a held key and names the key', () => {
    const overlay = new StageOverlay()
    overlay.mount('a', element())

    expect(() => overlay.mount('a', element())).toThrow("overlay key 'a' is already held")
  })

  it('writes a placement straight to the element style, centered on the position', () => {
    const overlay = new StageOverlay()
    const el = element()
    overlay.mount('a', el)

    overlay.place('a', { kind: 'placed', x: 12.5, y: 30.25 })

    expect(el.style.visibility).toBe('visible')
    expect(el.style.transform).toBe('translate(12.5px, 30.25px) translate(-50%, -50%)')
  })

  it('hides with visibility and never with display, so animations survive', () => {
    const overlay = new StageOverlay()
    const el = element()
    overlay.mount('a', el)
    overlay.place('a', { kind: 'placed', x: 1, y: 2 })

    overlay.place('a', { kind: 'hidden' })

    expect(el.style.visibility).toBe('hidden')
  })

  it('keeps a placement written before its element mounts and applies it at the mount', () => {
    const overlay = new StageOverlay()
    overlay.place('a', { kind: 'placed', x: 5, y: 6 })
    const el = element()

    overlay.mount('a', el)

    expect(el.style.visibility).toBe('visible')
    expect(el.style.transform).toBe('translate(5px, 6px) translate(-50%, -50%)')
  })

  it('remounts a released key at its last placement, so a remount never flashes hidden', () => {
    const overlay = new StageOverlay()
    const first = element()
    const release = overlay.mount('a', first)
    overlay.place('a', { kind: 'placed', x: 5, y: 6 })
    release()

    const second = element()
    overlay.mount('a', second)

    expect(second.style.visibility).toBe('visible')
    expect(second.style.transform).toBe('translate(5px, 6px) translate(-50%, -50%)')
  })

  it('fails a stale release loudly and leaves the later mount standing', () => {
    const overlay = new StageOverlay()
    const stale = overlay.mount('a', element())
    stale()
    const kept = element()
    overlay.mount('a', kept)

    expect(() => stale()).toThrow('stale')
    // The later mount still takes the key's placements.
    overlay.place('a', { kind: 'placed', x: 1, y: 2 })
    expect(kept.style.transform).toBe('translate(1px, 2px) translate(-50%, -50%)')
  })
})
