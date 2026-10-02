// The azimuth readout rule: the controls' accumulated azimuth, normalized
// to [0, 360) degrees. camera-controls adds every full turn to its azimuth
// angle, so the readout normalizes with a euclidean modulo, which stays in
// range for negative angles and for any number of accumulated turns. 0
// degrees means looking from +Z, the product's front.

export function normalizedAzimuthDegrees(azimuthRadians: number): number {
  const degrees = (azimuthRadians * 180) / Math.PI
  return degrees - 360 * Math.floor(degrees / 360)
}
