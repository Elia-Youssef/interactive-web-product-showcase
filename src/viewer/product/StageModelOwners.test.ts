import { describe, expect, it } from 'vitest'
import { StageModelOwners } from './StageModelOwners'

describe('stage model owners', () => {
  it('observes both obsolete settling work and the fresh canvas until each owner drains', () => {
    const owners = new StageModelOwners()
    const obsolete = { report: () => ({ models: [], bytes: [], settling: 1 }) }
    const fresh = {
      report: () => ({ models: ['/models/new.glb'], bytes: ['/models/ahead.glb'], settling: 0 }),
    }
    const releaseObsolete = owners.register(obsolete)
    const releaseFresh = owners.register(fresh)
    expect(owners.report()).toEqual({
      models: ['/models/new.glb'],
      bytes: ['/models/ahead.glb'],
      settling: 1,
    })
    releaseObsolete()
    expect(owners.report()).toEqual({
      models: ['/models/new.glb'],
      bytes: ['/models/ahead.glb'],
      settling: 0,
    })
    releaseFresh()
    expect(owners.report()).toEqual({ models: [], bytes: [], settling: 0 })
  })

  it('rejects duplicate registration and stale release', () => {
    const owners = new StageModelOwners()
    const owner = { report: () => ({ models: [], bytes: [], settling: 0 }) }
    const release = owners.register(owner)
    expect(() => owners.register(owner)).toThrow('already registered')
    release()
    expect(() => release()).toThrow('released twice')
  })
})
