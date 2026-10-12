import { createContext, useCallback, useContext } from 'react'
import type { RefCallback } from 'react'
import type { StageSurface } from './stageSurface'

// The context that hands the stage surface to the canvas content. R3F
// bridges outer context into the canvas, so a component that arrives as the
// stage's opaque content node claims its custom properties through the
// stage's own channel, on the element the app layout bound.

export const StageSurfaceContext = createContext<StageSurface | null>(null)

// The stage surface around the calling component. A component that claims a
// surface property but renders outside the stage is a composition error, so
// it fails loudly instead of writing against nothing.
export function useStageSurface(): StageSurface {
  const surface = useContext(StageSurfaceContext)
  if (surface === null) {
    throw new Error('a component that claims a stage surface property renders outside the stage')
  }
  return surface
}

// The ref the stage's element owner puts on its section element. React
// attaches a ref before any effect of the commit runs, so the channel is
// bound before the canvas content's first claim, and the returned cleanup
// unbinds on the element's detach.
export function useStageSurfaceElement(surface: StageSurface): RefCallback<HTMLElement> {
  return useCallback(
    (element: HTMLElement | null) => {
      if (element === null) {
        return undefined
      }
      return surface.attach(element)
    },
    [surface],
  )
}
