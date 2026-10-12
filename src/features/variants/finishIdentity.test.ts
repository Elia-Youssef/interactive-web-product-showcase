import { MeshStandardMaterial } from 'three/webgpu'
import { describe, expect, it } from 'vitest'
import { createFinishApplier } from './finishApplier'
import { fakeLoad, GRAPHITE, ownerOf, SAGE } from './finishApplier.fixtures'

describe('the finish reader material identity', () => {
  it.each(['shared', ''])(
    'reads distinct materials labelled %j by object identity',
    async (name) => {
      const world = fakeLoad()
      for (const material of world.materials) material.name = name
      const failures: Error[] = []
      const applier = createFinishApplier(ownerOf(world.loaded, () => Promise.resolve(), failures))
      const foreign = new MeshStandardMaterial({ name })
      try {
        applier.apply(GRAPHITE)
        await applier.firstApplied
        expect(world.shell.material).toBe(world.materials[1])
        expect(world.trim.material).toBe(world.materials[4])
        expect(applier.readFinish().applied).toBe(GRAPHITE)
        expect(applier.readFinish().materials).toEqual({ '0:0': name, '1:0': name, '2:0': name })

        world.shell.material = world.materials[0]
        expect(applier.readFinish().applied).toBeNull()
        world.trim.material = world.materials[3]
        expect(applier.readFinish().applied).toBe(SAGE)
        world.shell.material = foreign
        expect(applier.readFinish().applied).toBeNull()
        expect(failures).toEqual([])
      } finally {
        applier.dispose()
        foreign.dispose()
        for (const material of world.materials) material.dispose()
        for (const mesh of [world.shell, world.trim, world.grille]) mesh.geometry.dispose()
      }
    },
  )
})
