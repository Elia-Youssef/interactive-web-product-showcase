import type { Frameloop } from '@react-three/fiber'
import { NeutralToneMapping, SRGBColorSpace } from 'three'

// The stage's fixed settings, declared once. Every tunable names its unit or
// kind, and nothing reaches the renderer that is not written here.
export type StageConfig = {
  // R3F renders only when something invalidates, so demand mode saves the
  // rendering of an idle stage. It does not save the loop: three keeps its
  // own rAF running after init().
  readonly frameloop: Frameloop
  // Device pixel ratio, clamped: 1 stays sharp, 2 keeps the fill rate sane.
  readonly dpr: [number, number]
  // After an async gl factory R3F stamps its own tone mapping,
  // so the stage writes this in an effect inside the Canvas, after configure.
  readonly toneMapping: typeof NeutralToneMapping
  // The space the canvas presents in. The node renderer converts every
  // frame to this space in its output pass, and three's color management
  // keeps the working space linear sRGB, so the sRGB canvas is the one
  // correct presentation for the CSS page. R3F stamps sRGB of its own after
  // an async gl factory, as it stamps tone mapping; the stage writes the
  // value here so its color management is declared, not inherited.
  readonly outputColorSpace: typeof SRGBColorSpace
  // Handed to the WebGPU adapter request. R3F's factory props type this
  // wider than the backend takes, so the factory pins it explicitly.
  readonly powerPreference: 'high-performance'
  // A transparent clear: the page background behind the canvas shows through.
  readonly clearColorHex: number
  readonly clearAlpha: number
  // The canvas context carries alpha so the transparent clear can do its
  // work, and the backend multi-samples the frame's edges.
  readonly alpha: boolean
  readonly antialias: boolean
  // The environment map the stage lights its content with, served from
  // public/env. Reflections only, never a background.
  readonly environmentFile: string
}

export const stageConfig: StageConfig = {
  frameloop: 'demand',
  dpr: [1, 2],
  toneMapping: NeutralToneMapping,
  outputColorSpace: SRGBColorSpace,
  powerPreference: 'high-performance',
  clearColorHex: 0x000000,
  clearAlpha: 0,
  alpha: true,
  antialias: true,
  environmentFile: '/env/studio_small_09_1k.hdr',
}
