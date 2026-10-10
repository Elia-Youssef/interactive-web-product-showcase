import { createContext, useContext } from 'react'
import type { OrbitTurn } from '@lib/camera/orbitStep'
import type { CameraPlan } from './productPlan'

// The stage camera's API, for the components inside the Canvas that move
// the camera as part of presenting a product. The UI outside the Canvas
// never uses it: its requests travel through the store's camera channel,
// which the StageCamera executes.

export type StageCameraApi = {
  // Registers the product's plan and shows one of its views at once, with
  // no transition: the product presentation calls this before ready, so
  // the first presented frame is already the home view.
  present(plan: CameraPlan, viewId: string): void
  // Eases to one of the plan's views, or moves at once under reduced
  // motion. Resolves when the controls reach rest. The API hotspot
  // close-ups reuse later.
  transitionTo(viewId: string): Promise<void>
  // Steps the zoom by configured steps toward the product (positive) or
  // away from it (negative), eased like a transition, and resolves at rest.
  zoomStep(steps: number): Promise<void>
  // Turns the orbit from where the current move ends, the tilt clamped to
  // the plan's polar limits, eased like a transition, and resolves at rest.
  rotateStep(turn: OrbitTurn): Promise<void>
  // Ends the presentation: the plan is dropped, the controls stop
  // listening, and the readouts go idle. The product presentation calls
  // this when its product leaves the stage.
  release(): void
}

export const StageCameraContext = createContext<StageCameraApi | null>(null)

// The stage camera of the stage the calling component renders in. A caller
// outside a stage that owns the camera is a composition error and fails
// loudly instead of moving a camera nobody presented.
export function useStageCamera(): StageCameraApi {
  const api = useContext(StageCameraContext)
  if (api === null) {
    throw new Error('a camera caller renders outside the stage camera that would move it')
  }
  return api
}
