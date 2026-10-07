// The finish swatch: a 22px circle in the
// product's finish color. The color is product imagery from the manifest
// and is the only non-token color a primitive takes, passed in as a prop
// and set inline. Checked: the off-white ring, offset from the circle. The
// accessible name comes from the finish label. It is one radio of a
// single-choice group, so the checked state is the group's, announced as
// the radio's own.

import type { ComponentProps } from 'react'
import styles from './Swatch.module.css'
import { joinClassNames } from './joinClassNames'

type SwatchBase = Omit<
  ComponentProps<'button'>,
  'type' | 'children' | 'style' | 'aria-label' | 'aria-checked'
>

export type SwatchProps = SwatchBase & {
  color: string
  label: string
  checked?: boolean
}

export function Swatch({ color, label, checked = false, className, ...rest }: SwatchProps) {
  return (
    <button
      {...rest}
      type="button"
      className={joinClassNames(styles.swatch, className)}
      style={{ backgroundColor: color }}
      role="radio"
      aria-label={label}
      aria-checked={checked}
    />
  )
}
