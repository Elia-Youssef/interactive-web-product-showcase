// The dev HUD's display text: the formats the HUD renders its numbers
// with, and the text the HUD shows at rest. The HUD owns its display
// formatting, never the statistics: the math is exact. The e2e settle
// reads the rest text to wait out the rolling window's drain, so the
// component and the specs spell it once, here.

export function formatFps(fps: number): string {
  return fps.toFixed(1)
}

export function formatTickMs(tickMs: number | null): string {
  return tickMs === null ? '-' : `${tickMs.toFixed(1)} ms`
}

// The text the HUD shows when its rolling window holds no frame: the rate
// has fallen to zero and no tick is left to average. The window drains
// about a second after the last frame, and the text is static from then on.
export const hudRestText = {
  fps: formatFps(0),
  tickMs: formatTickMs(null),
} as const
