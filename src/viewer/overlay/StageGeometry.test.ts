import { describe, expect, it, vi } from 'vitest'
import { StageGeometry } from './StageGeometry'

function geometryRoot() {
  const origin = { left: 100, top: 50, right: 900, bottom: 650, width: 800, height: 600 }
  const bounds = { left: 700, top: 500, right: 850, bottom: 600, width: 150, height: 100 }
  const read = vi.fn(() => bounds)
  return {
    bounds,
    read,
    root: {
      getBoundingClientRect: () => origin,
      children: [
        { getBoundingClientRect: read },
        { getBoundingClientRect: () => ({ ...bounds, width: 0, height: 0 }) },
      ],
    },
  }
}

describe('StageGeometry', () => {
  it('shares one relative obstacle snapshot, excludes absent slots and reads no steady-frame DOM', () => {
    const { root, read } = geometryRoot()
    const geometry = new StageGeometry()
    geometry.setChrome(root)
    const snapshot = geometry.read({ width: 800, height: 600 })
    expect(snapshot).toEqual([{ left: 600, top: 450, right: 750, bottom: 550 }])
    expect(geometry.read()).toBe(snapshot)
    expect(geometry.read({ width: 800, height: 600 })).toBe(snapshot)
    expect(read).toHaveBeenCalledTimes(1)
  })

  it('replaces the snapshot on chrome content resize and on stage resize', () => {
    const { root, bounds } = geometryRoot()
    const geometry = new StageGeometry()
    const changed = vi.fn()
    const release = geometry.subscribe(changed)
    geometry.setChrome(root)
    const before = geometry.read({ width: 800, height: 600 })
    bounds.left = 500
    geometry.changed()
    expect(geometry.read()[0]?.left).toBe(400)
    expect(geometry.read()).not.toBe(before)
    bounds.left = 450
    expect(geometry.read({ width: 700, height: 600 })[0]?.left).toBe(350)
    expect(changed).toHaveBeenCalledTimes(2)
    release()
    geometry.changed()
    expect(changed).toHaveBeenCalledTimes(2)
  })

  it('clears retired chrome without keeping obstacles from the prior life', () => {
    const { root } = geometryRoot()
    const geometry = new StageGeometry()
    geometry.setChrome(root)
    expect(geometry.read()).toHaveLength(1)
    geometry.setChrome(null)
    expect(geometry.read()).toEqual([])
  })
})
