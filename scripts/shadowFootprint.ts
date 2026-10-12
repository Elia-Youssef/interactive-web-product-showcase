// Pixel edges, not pixel centers, bound the thresholded region. UV endpoints
// state the world directions of the input rows, including reversed axes.
export type Bounds2 = {
  readonly x: readonly [number, number]
  readonly y: readonly [number, number]
}
export type AlphaGrid = {
  readonly width: number
  readonly height: number
  readonly alpha: ArrayLike<number>
}
export type ShadowPlane = { readonly boundsM: Bounds2; readonly uvBoundsM: Bounds2 }
export type ShadowMeasure = {
  readonly regionPx: Bounds2
  readonly edgeAlpha: number
  readonly alphaBoundsM: Bounds2
  readonly fittedBoundsM: Bounds2
  readonly sideDifferencesM: Bounds2
  readonly texelM: { readonly x: number; readonly y: number }
  readonly fits: boolean
  readonly unclipped: boolean
}

export function alphaRegion(
  grid: AlphaGrid,
  threshold: number,
): { regionPx: Bounds2; edgeAlpha: number } {
  if (
    !Number.isInteger(grid.width) ||
    !Number.isInteger(grid.height) ||
    grid.width < 1 ||
    grid.height < 1 ||
    grid.alpha.length !== grid.width * grid.height
  ) {
    throw new Error('alpha grid must have positive integer dimensions and one value per texel')
  }
  let x0 = grid.width,
    y0 = grid.height,
    x1 = 0,
    y1 = 0,
    edgeAlpha = 0
  for (let y = 0; y < grid.height; y += 1) {
    for (let x = 0; x < grid.width; x += 1) {
      const alpha = grid.alpha[y * grid.width + x]
      if (alpha === undefined || !Number.isFinite(alpha) || alpha < 0 || alpha > 1) {
        throw new Error('shadow alpha must be finite and between zero and one')
      }
      if (x === 0 || y === 0 || x === grid.width - 1 || y === grid.height - 1)
        edgeAlpha = Math.max(edgeAlpha, alpha)
      if (alpha > threshold) {
        x0 = Math.min(x0, x)
        x1 = Math.max(x1, x + 1)
        y0 = Math.min(y0, y)
        y1 = Math.max(y1, y + 1)
      }
    }
  }
  if (x1 === 0) throw new Error(`no shadow pixel exceeds alpha ${threshold}`)
  return { regionPx: { x: [x0, x1], y: [y0, y1] }, edgeAlpha }
}

export function measureShadowFootprint(
  grid: AlphaGrid,
  plane: ShadowPlane,
  settings: {
    readonly alphaThreshold: number
    readonly padM: number
    readonly fitToleranceTexels: number
  },
): ShadowMeasure {
  const { regionPx, edgeAlpha } = alphaRegion(grid, settings.alphaThreshold)
  const x = measureAxis(regionPx.x, grid.width, plane.boundsM.x, plane.uvBoundsM.x, settings.padM)
  const y = measureAxis(regionPx.y, grid.height, plane.boundsM.y, plane.uvBoundsM.y, settings.padM)
  const within = (axis: ReturnType<typeof measureAxis>) =>
    axis.differences.every((value) => Math.abs(value) <= settings.fitToleranceTexels * axis.texelM)
  return {
    regionPx,
    edgeAlpha,
    alphaBoundsM: { x: x.alphaBounds, y: y.alphaBounds },
    fittedBoundsM: { x: x.fittedBounds, y: y.fittedBounds },
    sideDifferencesM: { x: x.differences, y: y.differences },
    texelM: { x: x.texelM, y: y.texelM },
    fits: within(x) && within(y),
    unclipped: edgeAlpha <= settings.alphaThreshold,
  }
}

function measureAxis(
  region: readonly [number, number],
  size: number,
  bounds: readonly [number, number],
  mapping: readonly [number, number],
  padM: number,
) {
  if (
    ![...bounds, ...mapping].every(Number.isFinite) ||
    bounds[1] <= bounds[0] ||
    mapping[0] === mapping[1]
  ) {
    throw new Error('shadow plane and UV mapping must have positive finite spans')
  }
  const world = region.map((pixel) => mapping[0] + (pixel / size) * (mapping[1] - mapping[0]))
  const alphaBounds: readonly [number, number] = [Math.min(...world), Math.max(...world)]
  const fittedBounds: readonly [number, number] = [alphaBounds[0] - padM, alphaBounds[1] + padM]
  const differences: readonly [number, number] = [
    bounds[0] - fittedBounds[0],
    bounds[1] - fittedBounds[1],
  ]
  return {
    alphaBounds,
    fittedBounds,
    differences,
    texelM: Math.abs(mapping[1] - mapping[0]) / size,
  }
}
