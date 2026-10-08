// The text button: an uppercase tracked label
// with no surface. Hover lifts the label to white.
// Selected also draws the persistent off underline, so selected and hover
// stay distinguishable. It is a toggle only when the caller passes
// selected: without it, the button is a plain action and announces no
// pressed state. Mixed draws its own look. The label copy comes from the caller.

import type { ComponentProps } from 'react'
import styles from './TextButton.module.css'
import { joinClassNames } from './joinClassNames'

type TextButtonBase = Omit<ComponentProps<'button'>, 'type' | 'children' | 'aria-pressed'>

export type TextButtonProps = TextButtonBase & {
  children: string
  // true and false announce a toggle; 'mixed' announces a partial state
  // (a tri-state toggle). Omitted, the button is a plain action.
  selected?: boolean | 'mixed'
}

export function TextButton({ children, selected, className, ...rest }: TextButtonProps) {
  return (
    <button
      {...rest}
      type="button"
      className={joinClassNames(styles.button, className)}
      aria-pressed={selected}
    >
      {children}
    </button>
  )
}
