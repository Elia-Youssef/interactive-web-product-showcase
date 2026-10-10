export type ScrollAxis = {
  readonly position: number
  readonly maximum: number
  readonly start: number
  readonly end: number
  readonly viewStart: number
  readonly viewEnd: number
}

// Start alignment keeps a tall card's header reachable. Nearest alignment
// changes the other axis only when its target lies outside the scrollport.
export function scrollTarget(axis: ScrollAxis, align: 'start' | 'nearest'): number {
  let delta = axis.start - axis.viewStart
  if (align === 'nearest') {
    if (axis.start >= axis.viewStart && axis.end <= axis.viewEnd) delta = 0
    else if (axis.start < axis.viewStart && axis.end > axis.viewEnd) delta = 0
    else {
      const larger = axis.end - axis.start > axis.viewEnd - axis.viewStart
      const startOutside = axis.start < axis.viewStart
      delta = startOutside !== larger ? axis.start - axis.viewStart : axis.end - axis.viewEnd
    }
  }
  // A whole CSS pixel is representable in every engine, so native end
  // can prove the exact requested target rather than an engine's rounding.
  const target = axis.position + delta
  const fitting = align === 'nearest' && axis.end - axis.start <= axis.viewEnd - axis.viewStart
  const represented =
    fitting && delta !== 0
      ? delta > 0
        ? Math.ceil(target)
        : Math.floor(target)
      : Math.round(target)
  return Math.min(axis.maximum, Math.max(0, represented))
}
