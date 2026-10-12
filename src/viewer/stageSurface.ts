// The stage surface: the channel that writes the stage section element's
// CSS custom properties on behalf of the scene content inside the canvas.
// The app layout binds its section element here, and the canvas content
// claims named properties on it through the context. A claimed property is
// written straight to the element's style, with no React state and no
// re-render per frame, and its release removes it again, so an unmount
// returns the element to what its stylesheet resolves by default.

// The one element capability the channel writes through, stated
// structurally: the stage hands its section element over, and a test can
// stand in for it.
export type StageSurfaceElement = {
  readonly style: {
    readonly setProperty: (property: string, value: string, priority?: string) => void
    readonly removeProperty: (property: string) => string
  }
}

// One claimed property of the stage surface. set writes the value now;
// release removes it and closes the claim. A released claim fails loudly on
// any further use, like a stale stage probe release.
export type StageSurfaceProperty = {
  readonly set: (value: string) => void
  readonly release: () => void
}

export type StageSurface = {
  // Binds the element the channel writes on, one at a time: a second bind
  // while one is held fails loudly. The returned call unbinds.
  readonly attach: (element: StageSurfaceElement) => () => void
  // Claims a named custom property. A name is held by one claim at a time,
  // so two writers of one property fail loudly instead of fighting.
  readonly claim: (property: string) => StageSurfaceProperty
}

// One claimed property: writes on the bound element as it stands now, and
// removes on release. The element is read at call time, so a release after
// the stage unbound its element still closes the claim, with nothing left
// to remove.
function claimProperty(
  property: string,
  readElement: () => StageSurfaceElement | null,
  onRelease: () => void,
): StageSurfaceProperty {
  let released = false
  return {
    set(value) {
      if (released) {
        throw new Error(`the stage surface property '${property}' is released`)
      }
      const element = readElement()
      if (element === null) {
        throw new Error(
          `the stage surface property '${property}' is set after the stage released its element`,
        )
      }
      element.style.setProperty(property, value)
    },
    release() {
      if (released) {
        throw new Error(`the release of the stage surface property '${property}' is stale`)
      }
      released = true
      onRelease()
      readElement()?.style.removeProperty(property)
    },
  }
}

export function createStageSurface(): StageSurface {
  let element: StageSurfaceElement | null = null
  const claimed = new Set<string>()

  return {
    attach(bound) {
      if (element !== null) {
        throw new Error('the stage surface already holds a section element')
      }
      element = bound
      return () => {
        if (element !== bound) {
          throw new Error('the release of the stage surface element is stale')
        }
        element = null
      }
    },
    claim(property) {
      if (element === null) {
        throw new Error(
          `the stage surface property '${property}' is claimed before the stage bound its element`,
        )
      }
      if (claimed.has(property)) {
        throw new Error(`the stage surface property '${property}' is already claimed`)
      }
      claimed.add(property)
      return claimProperty(
        property,
        () => element,
        () => {
          claimed.delete(property)
        },
      )
    },
  }
}

// The backdrop grid's emphasis input, the one custom property the exploded
// view writes. The grid alpha's step from rest to exploded against this
// name lives in the backdrop's own stylesheet (StageBackdrop.module.css),
// with the alpha tokens in tokens.css; the backdrop names no feature, and
// the property carries no value but the emphasis itself.
export const gridEmphasisProperty = '--backdrop-grid-emphasis'
