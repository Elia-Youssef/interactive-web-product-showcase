// The surface pill for controls that need a shaped hit area, such as zoom
// and reset. It takes one icon as its child;
// the icon strokes itself in the button's currentColor, so hover styles one
// color. The accessible name is required by the type, because an icon has
// no text of its own.

import type { ComponentProps } from 'react'
import styles from './IconButton.module.css'
import { joinClassNames } from './joinClassNames'

type IconButtonBase = Omit<ComponentProps<'button'>, 'type'>

export type IconButtonProps = IconButtonBase & {
  'aria-label': string
}

export function IconButton({ className, ...rest }: IconButtonProps) {
  return (
    <button
      {...rest}
      type="button"
      className={joinClassNames(styles.button, className)}
    />
  )
}
