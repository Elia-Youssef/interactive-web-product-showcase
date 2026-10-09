// The hotspot marker: a real button that sits over the stage and points at
// a spot on the product. The visual is a two-tone dot in a ring on a hit
// area that clears the touch minimum; the caller names it, and its pressed
// state is the hotspot's active state. The stylesheet runs the one
// first-load pulse; the stage overlay hides the button with visibility, so
// hiding and showing never restarts it.
//
// The data-force-hover attribute exists for the dev-only gallery: it forces
// the hover state without a pointer. App code never sets it.

import type { ComponentProps } from 'react'
import styles from './Marker.module.css'
import { joinClassNames } from './joinClassNames'

type MarkerBase = Omit<
  ComponentProps<'button'>,
  'type' | 'children' | 'aria-label' | 'aria-pressed'
>

export type MarkerProps = MarkerBase & {
  // The accessible name: the marker is named by what it points at, never by
  // the word marker.
  label: string
  // The hotspot's active state, carried as the button's pressed state.
  active?: boolean
}

export function Marker({ label, active = false, className, ...rest }: MarkerProps) {
  return (
    <button
      {...rest}
      type="button"
      className={joinClassNames(styles.marker, className)}
      aria-label={label}
      aria-pressed={active}
    >
      <span className={styles.pulse} aria-hidden="true" />
    </button>
  )
}
