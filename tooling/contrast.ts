// WCAG 2 contrast math, pure: relative luminance, alpha compositing and the
// contrast ratio. The token contrast test builds on it, so the formulas live
// in one place and have their own table test.

export type Rgb = readonly [number, number, number]
export type Rgba = { readonly rgb: Rgb; readonly alpha: number }

function channelLuminance(channel: number): number {
  const unit = channel / 255
  return unit <= 0.04045 ? unit / 12.92 : ((unit + 0.055) / 1.055) ** 2.4
}

export function relativeLuminance([red, green, blue]: Rgb): number {
  return (
    0.2126 * channelLuminance(red) +
    0.7152 * channelLuminance(green) +
    0.0722 * channelLuminance(blue)
  )
}

// The color a translucent foreground shows when painted over an opaque
// background, composited in sRGB the way browsers blend.
export function compositeOver(foreground: Rgba, background: Rgb): Rgb {
  const blend = (front: number, back: number): number =>
    front * foreground.alpha + back * (1 - foreground.alpha)
  return [
    blend(foreground.rgb[0], background[0]),
    blend(foreground.rgb[1], background[1]),
    blend(foreground.rgb[2], background[2]),
  ]
}

export function contrastRatio(first: Rgb, second: Rgb): number {
  const lighter = Math.max(relativeLuminance(first), relativeLuminance(second))
  const darker = Math.min(relativeLuminance(first), relativeLuminance(second))
  return (lighter + 0.05) / (darker + 0.05)
}
