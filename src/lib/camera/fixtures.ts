// The lens table shared by the lens tests: a base lens and the view lens
// it must present, in degrees. The close-up pairs are the shape the design
// cares about, a home lens of tens of degrees and close-ups in the low
// teens, which the zoom must carry without rounding.
export const LENS_TABLE = [
  { base: 25, view: 11 },
  { base: 11, view: 25 },
  { base: 25, view: 10 },
  { base: 25, view: 12 },
  { base: 10, view: 25 },
  { base: 45, view: 30 },
] as const

// Degrees to radians, the unit the lens math and the camera's fov API
// speak in.
export function degrees(value: number): number {
  return (value * Math.PI) / 180
}
