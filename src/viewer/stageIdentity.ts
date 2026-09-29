import { Scene, WebGPURenderer } from 'three/webgpu'

// The start-up identity checks of the stage, on the live objects R3F hands
// it. They run inside the Canvas, where a throw reaches the stage's error
// boundary and lands in the store as a named failure, so a broken setup
// fails loudly instead of rendering silently.

// The renderer the stage renders through must be the one its factory built,
// from the three/webgpu module the stage imports, never a renderer that came
// out of a second copy of three.
export function assertStageRenderer(gl: object): void {
  if (!(gl instanceof WebGPURenderer)) {
    throw new Error('The stage needs the WebGPURenderer its factory built')
  }
}

// R3F's scene must come from the same three instance the stage renderer was
// built from. A second copy of three renders without an error of its own and
// breaks in ways nothing else checks; this check fails that setup loudly.
export function assertStageScene(scene: object): void {
  if (!(scene instanceof Scene)) {
    throw new Error(
      'The stage scene does not come from the three instance the stage renderer was built from: one copy of three is expected',
    )
  }
}
