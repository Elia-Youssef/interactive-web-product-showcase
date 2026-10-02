import type { Material } from 'three'

// The one owner of the shadow material's opacity. The loader authors an
// opacity, the product's look scales it by its shadow factor, and the
// exploded view fades it by its own factor; exactly one module composes the
// three, so no two writers can fight over the same property. The owner
// reads the authored value once at creation and writes
// authored x lookFactor x fadeFactor on every factor change.

// One claimed fade factor. set scales the shadow's opacity by it; release
// puts the factor back to 1 and closes the claim. A released claim fails
// loudly on any further use, like a stale stage probe release.
export type ShadowFadeClaim = {
  readonly set: (factor: number) => void
  readonly release: () => void
}

export type ShadowOpacityOwner = {
  // The look's factor: what the product's look block scales the authored
  // opacity by. Replaces any factor set before.
  readonly setLookFactor: (factor: number) => void
  // Claims the fade factor for one feature reaction. One claim at a time: a
  // second claim while one is held would let two writers fight, so it fails
  // loudly instead.
  readonly claimFadeFactor: () => ShadowFadeClaim
  // Puts the authored opacity back, for when the product leaves.
  readonly restore: () => void
}

export function createShadowOpacityOwner(material: Material): ShadowOpacityOwner {
  // The opacity the loader authored, read before any factor is applied: the
  // restore returns it, so a later presentation starts from the authored
  // value.
  const authored = material.opacity
  let lookFactor = 1
  let fadeFactor = 1
  let claimed = false
  // The product's leave is the owner's last word. The look's cleanup and the
  // reaction's cleanup are separate effects, and React does not order one
  // over the other, so a claim's release can run after the restore; once
  // restored, the composition stands down and the authored value is the
  // state the material holds for the next presentation.
  let restored = false

  const write = () => {
    if (!restored) {
      material.opacity = authored * lookFactor * fadeFactor
    }
  }

  return {
    setLookFactor(factor) {
      lookFactor = factor
      write()
    },
    claimFadeFactor() {
      if (claimed) {
        throw new Error('the shadow fade factor is already claimed')
      }
      if (restored) {
        throw new Error('the shadow fade factor is claimed after the product left')
      }
      claimed = true
      let released = false
      return {
        set(factor) {
          if (released) {
            throw new Error('a released shadow fade claim cannot set a factor')
          }
          if (restored) {
            throw new Error('a shadow fade claim cannot set a factor after the product left')
          }
          fadeFactor = factor
          write()
        },
        release() {
          if (released) {
            throw new Error('the release of the shadow fade claim is stale')
          }
          released = true
          claimed = false
          fadeFactor = 1
          write()
        },
      }
    },
    restore() {
      restored = true
      material.opacity = authored
    },
  }
}

// The per-product slot that hands the owner to its two writers: the look
// installs it, the features claim the fade factor through it. One owner at
// a time, held for the product's presented lifetime; an install while one
// is held, a claim with none installed, or a stale install release all fail
// loudly.
export type ShadowOpacityHolder = {
  readonly install: (owner: ShadowOpacityOwner) => () => void
  readonly claimFadeFactor: () => ShadowFadeClaim
}

export function createShadowOpacityHolder(): ShadowOpacityHolder {
  let owner: ShadowOpacityOwner | null = null

  return {
    install(installed) {
      if (owner !== null) {
        throw new Error('the shadow opacity owner is already installed')
      }
      owner = installed
      return () => {
        if (owner !== installed) {
          throw new Error('the release of the shadow opacity owner is stale')
        }
        owner = null
      }
    },
    claimFadeFactor() {
      if (owner === null) {
        throw new Error('the shadow fade factor is claimed before the look installed its owner')
      }
      return owner.claimFadeFactor()
    },
  }
}
