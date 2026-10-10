// The surface pill for controls that need a shaped hit area, such as zoom
// and reset. It takes one icon as its child;
// the icon strokes itself in the button's currentColor, so hover styles one
// color. The accessible name is required by the type, because an icon has
// no text of its own. A control that waits while it may hold focus takes
// `unavailable`, never the disabled attribute; the rule lives in
// unavailable.ts, shared with every primitive of the library.

import type { ComponentProps, ReactElement } from 'react'
import styles from './IconButton.module.css'
import { joinClassNames } from './joinClassNames'
import { ignoresActivation, unavailableAttributes, type UnavailableProps } from './unavailable'

type IconButtonBase = Omit<ComponentProps<'button'>, 'type' | 'aria-disabled'>

export type IconButtonProps = IconButtonBase & UnavailableProps & { 'aria-label': string }

// The element return type is explicit, so the primitive is a plain function
// of its props to its element: the wiring a renderer would attach is the
// element's own props, which the contract tests read directly.
export function IconButton({
  unavailable,
  disabled,
  onClick,
  className,
  ...rest
}: IconButtonProps): ReactElement<IconButtonProps> {
  return (
    <button
      {...rest}
      {...unavailableAttributes(unavailable)}
      type="button"
      disabled={disabled}
      className={joinClassNames(styles.button, className)}
      onClick={ignoresActivation({ disabled, unavailable }) ? undefined : onClick}
    />
  )
}
