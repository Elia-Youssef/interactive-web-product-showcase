export const raBox = 1080

export const raGlyphPoints = [
  [745.8, 271.9],
  [844.1, 722.7],
  [775.7, 737.5],
  [693.0, 355.4],
  [330.3, 433.4],
  [353.8, 542.0],
  [393.3, 567.5],
  [620.2, 518.8],
  [649.4, 473.7],
  [663.4, 538.7],
  [630.5, 589.7],
  [537.0, 610.4],
  [402.6, 819.1],
  [307.6, 839.5],
  [442.1, 630.7],
  [371.9, 645.5],
  [291.0, 593.0],
  [245.2, 380.2],
] as const

export const raPolygon = raGlyphPoints.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(' ')
export const raViewBox = `0 0 ${raBox} ${raBox}`
