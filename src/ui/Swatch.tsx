// The finish swatch: a 22px circle in the
// product's finish color. The color is product imagery from the manifest
// and is the only non-token color a primitive takes, passed in as a prop
// and set inline. Selected: the off-white ring, offset from the circle.
// The accessible name comes from the finish label.

import type { ComponentProps } from 'react'
import styles from './Swatch.module.css'
import { joinClassNames } from './joinClassNames'

type SwatchBase = Omit<
  ComponentProps<'button'>,
  'type' | 'children' | 'style' | 'aria-label' | 'aria-pressed'
>

export type SwatchProps = SwatchBase & {
  color: string
  label: string
  selected?: boolean
}

export function Swatch({ color, label, selected = false, className, ...rest }: SwatchProps) {
  return (
    <button
      {...rest}
      type="button"
      className={joinClassNames(styles.swatch, className)}
      style={{ backgroundColor: color }}
      aria-label={label}
      aria-pressed={selected}
    />
  )
}
