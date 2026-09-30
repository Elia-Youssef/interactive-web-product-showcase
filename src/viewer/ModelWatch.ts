import type { ViewerModel } from './automation/viewerAutomation'

// The per-mount channel that carries the stage's loaded model from the
// canvas to its automation hook, like the frame clock carries frames. The
// stage creates one instance per mount; the model component reports into it
// from inside the canvas and the automation hook reads it at access time, so
// no module-level singleton and no stale copy can exist.

export class ModelWatch {
  private model: ViewerModel | null = null

  // Reports the model now in the scene. One stage shows one model, so a
  // second report replaces the first.
  report(model: ViewerModel): void {
    this.model = model
  }

  // Clears the report, on the model component's unmount.
  clear(): void {
    this.model = null
  }

  get current(): ViewerModel | null {
    return this.model
  }
}
