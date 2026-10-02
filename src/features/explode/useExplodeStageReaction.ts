import { useCallback } from 'react'
import { useShadowFadeClaim } from '@viewer/look/shadowOpacityContext'
import { gridEmphasisProperty } from '@viewer/stageSurface'
import { useStageSurface } from '@viewer/stageSurfaceContext'
import type { ExplodeReactionFactory } from './useExplodeReaction'

// The presented view's stage reaction: the shadow's fade factor follows one
// minus the applied progress, and the backdrop grid's emphasis follows the
// progress itself, both on the frame the pose lands on. The reaction claims
// its two inputs when it registers and its release restores them, so a
// remount returns the stage to rest whatever progress was applied.
export function useExplodeStageReaction(): ExplodeReactionFactory {
  const claimShadowFade = useShadowFadeClaim()
  const surface = useStageSurface()

  return useCallback(() => {
    const fade = claimShadowFade()
    const emphasis = surface.claim(gridEmphasisProperty)
    return {
      apply(progress) {
        fade.set(1 - progress)
        emphasis.set(String(progress))
      },
      release() {
        emphasis.release()
        fade.release()
      },
    }
  }, [claimShadowFade, surface])
}
