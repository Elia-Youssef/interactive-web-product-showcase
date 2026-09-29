// The shared contract of the icon set. Icons are decorative by default:
// every control that carries one is named through its own aria-label, so
// each icon hides itself from assistive tech.

export type IconProps = {
  size?: number
}

// The default icon box, in pixels. It is an SVG attribute, not a style
// value, so it lives here once instead of in a stylesheet per icon.
export const defaultIconSize = 16
