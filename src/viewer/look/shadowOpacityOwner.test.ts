import { describe, expect, it } from 'vitest'
import { MeshBasicMaterial } from 'three'
import { createShadowOpacityHolder, createShadowOpacityOwner } from './shadowOpacityOwner'

// The owner composes the shadow's opacity over the three writers' inputs.
// The table holds (authored, look factor, fade factor) triples with their
// exact products, so every row is an exact material read, never an
// approximation.
const COMPOSITION_CASES: readonly {
  readonly authored: number
  readonly look: number
  readonly fade: number
  readonly opacity: number
}[] = [
  { authored: 1, look: 1, fade: 1, opacity: 1 },
  { authored: 1, look: 0.5, fade: 1, opacity: 0.5 },
  { authored: 1, look: 0.5, fade: 0, opacity: 0 },
  { authored: 0.8, look: 0.25, fade: 0.5, opacity: 0.8 * 0.25 * 0.5 },
  { authored: 0.4, look: 1, fade: 0.25, opacity: 0.1 },
]

function ownerWithAuthored(authored: number) {
  const material = new MeshBasicMaterial()
  material.opacity = authored
  return { material, owner: createShadowOpacityOwner(material) }
}

describe('createShadowOpacityOwner', () => {
  it('writes the composition of the authored value and both factors', () => {
    for (const example of COMPOSITION_CASES) {
      const { material, owner } = ownerWithAuthored(example.authored)
      owner.setLookFactor(example.look)
      const fade = owner.claimFadeFactor()
      fade.set(example.fade)

      expect(material.opacity).toBe(example.opacity)

      fade.release()
    }
  })

  it('changes the opacity when the look changes its factor', () => {
    const { material, owner } = ownerWithAuthored(0.8)
    owner.setLookFactor(0.5)
    expect(material.opacity).toBe(0.4)

    owner.setLookFactor(0.25)
    expect(material.opacity).toBe(0.2)
  })

  it('puts the fade factor back to 1 when the claim releases', () => {
    const { material, owner } = ownerWithAuthored(0.8)
    owner.setLookFactor(0.5)
    const fade = owner.claimFadeFactor()
    fade.set(0)

    expect(material.opacity).toBe(0)

    fade.release()
    expect(material.opacity).toBe(0.4)
  })

  it('restores the authored opacity for when the product leaves', () => {
    const { material, owner } = ownerWithAuthored(0.8)
    owner.setLookFactor(0.5)
    const fade = owner.claimFadeFactor()
    fade.set(0.25)

    owner.restore()

    expect(material.opacity).toBe(0.8)
  })

  it('fails loudly on a second fade claim while one is held', () => {
    const { owner } = ownerWithAuthored(1)
    const fade = owner.claimFadeFactor()

    expect(() => owner.claimFadeFactor()).toThrow(/already claimed/)

    fade.release()
    owner.claimFadeFactor()
  })

  it('fails loudly on a released claim that sets or releases again', () => {
    const { owner } = ownerWithAuthored(1)
    const fade = owner.claimFadeFactor()
    fade.release()

    expect(() => fade.set(0.5)).toThrow(/released/)
    expect(() => fade.release()).toThrow(/stale/)
    expect(owner.claimFadeFactor()).toBeDefined()
  })

  it('keeps the authored value when the fade claim releases after the restore', () => {
    // The look's cleanup and the reaction's cleanup are separate effects
    // with no order between them; a release that lands after the restore
    // must leave the restore standing, or the next presentation reads the
    // look's scale as the authored value.
    const { material, owner } = ownerWithAuthored(0.8)
    owner.setLookFactor(0.5)
    const fade = owner.claimFadeFactor()
    fade.set(0.25)

    owner.restore()
    fade.release()

    expect(material.opacity).toBe(0.8)
  })

  it('fails loudly on a claim that sets after the restore', () => {
    const { material, owner } = ownerWithAuthored(0.8)
    const fade = owner.claimFadeFactor()

    owner.restore()
    expect(() => fade.set(0.25)).toThrow(/after the product left/)
    expect(material.opacity).toBe(0.8)
  })
})

describe('createShadowOpacityHolder', () => {
  it('hands the installed owner to the fade claims', () => {
    const holder = createShadowOpacityHolder()
    const { material, owner } = ownerWithAuthored(0.8)
    const releaseOwner = holder.install(owner)

    const fade = holder.claimFadeFactor()
    fade.set(0.5)
    expect(material.opacity).toBe(0.4)

    fade.release()
    releaseOwner()
  })

  it('fails loudly on a second install, a claim with none, and a stale release', () => {
    const holder = createShadowOpacityHolder()
    const { owner } = ownerWithAuthored(1)

    expect(() => holder.claimFadeFactor()).toThrow(/before the look installed/)
    const releaseOwner = holder.install(owner)
    expect(() => holder.install(owner)).toThrow(/already installed/)
    expect(() => releaseOwner()).not.toThrow()
    expect(() => releaseOwner()).toThrow(/stale/)
  })
})
