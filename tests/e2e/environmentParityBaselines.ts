// The measured lighting of the environment the stage serves, per product and
// backend: the masked product medians of a settled capture at the home view
// and first finish. The environment parity spec holds every live capture to
// these numbers within one 8-bit level per channel, so a re-encoded or
// replaced environment map cannot shift the stage's lighting silently.
//
// Each row was measured on the collection as shipped, through the same path
// the spec runs: the settled stage capture, the chrome corners masked, the
// pixels brighter than the backdrop ceiling inside the stage canvas. A
// product that joins the collection needs a measured row here; a missing row
// fails the spec by name. A row that no longer holds is re-measured on
// purpose, with the change that moved it explained, never widened.
export type EnvironmentParityBaseline = {
  readonly r: number
  readonly g: number
  readonly b: number
}

export type EnvironmentParityRow = Readonly<Record<'webgpu' | 'webgl2', EnvironmentParityBaseline>>

export const environmentParityBaselines: Readonly<Record<string, EnvironmentParityRow>> = {
  'forma-one': {
    webgpu: { r: 78, g: 80, b: 83 },
    webgl2: { r: 78, g: 80, b: 83 },
  },
  'orsa-kvern': {
    webgpu: { r: 213, g: 215, b: 218 },
    webgl2: { r: 213, g: 215, b: 218 },
  },
  'vidde-spak': {
    webgpu: { r: 235, g: 227, b: 214 },
    webgl2: { r: 235, g: 227, b: 214 },
  },
  'fjor-tast': {
    webgpu: { r: 71, g: 73, b: 77 },
    webgl2: { r: 71, g: 73, b: 77 },
  },
  'placeholder-speaker': {
    webgpu: { r: 121, g: 137, b: 114 },
    webgl2: { r: 121, g: 137, b: 114 },
  },
}
