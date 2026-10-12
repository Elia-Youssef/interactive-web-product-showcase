// The text button: an uppercase tracked label
// with no surface. Hover lifts the label to white.
// Selected also draws the persistent off underline, so selected and hover
// stay distinguishable. It is a toggle only when the caller passes
// selected: without it, the button is a plain action and announces no
// pressed state. Mixed draws its own look. The label copy comes from the
// caller. A control that waits while it may hold focus takes `unavailable`,
// never the disabled attribute; the rule lives in unavailable.ts, shared
// with every primitive of the library.

import type { ComponentProps, ReactElement } from 'react'
import styles from './TextButton.module.css'
import { joinClassNames } from './joinClassNames'
import { ignoresActivation, unavailableAttributes, type UnavailableProps } from './unavailable'

type TextButtonBase = Omit<
  ComponentProps<'button'>,
  'type' | 'children' | 'aria-pressed' | 'aria-disabled'
>

export type TextButtonProps = TextButtonBase &
  UnavailableProps & {
    children: string
    // true and false announce a toggle; 'mixed' announces a partial state
    // (a tri-state toggle). Omitted, the button is a plain action.
    selected?: boolean | 'mixed'
  }

// The element return type is explicit, so the primitive is a plain function
// of its props to its element: the wiring a renderer would attach is the
// element's own props, which the contract tests read directly.
export function TextButton({
  children,
  selected,
  unavailable,
  disabled,
  onClick,
  className,
  ...rest
}: TextButtonProps): ReactElement<TextButtonProps> {
  return (
    <button
      {...rest}
      {...unavailableAttributes(unavailable)}
      type="button"
      disabled={disabled}
      className={joinClassNames(styles.button, className)}
      aria-pressed={selected}
      onClick={ignoresActivation({ disabled, unavailable }) ? undefined : onClick}
    >
      {children}
    </button>
  )
}
