// The icon link: the link twin of the icon
// button, for a control that moves to a destination instead of acting. It
// renders through the link contract the caller hands in, so the app's
// routed link is its engine and this piece carries the look: a hit area
// at the control minimum with the icon centered, quiet until hover lifts
// it to white.

import type { ReactNode } from 'react'
import type { LinkComponent } from './link'
import styles from './IconLink.module.css'
import { joinClassNames } from './joinClassNames'

export type IconLinkProps = {
  // The app's link component, handed down from the composition: the piece
  // renders the address through it.
  readonly link: LinkComponent
  readonly to: string
  // An icon has no text of its own, so the accessible name is required.
  readonly 'aria-label': string
  readonly children: ReactNode
  readonly className?: string
  // The gallery's forced hover state; app code never sets it.
  readonly 'data-force-hover'?: boolean
}

export function IconLink({
  link: Link,
  to,
  'aria-label': label,
  children,
  className,
  'data-force-hover': forceHover,
}: IconLinkProps) {
  return (
    <Link
      to={to}
      aria-label={label}
      className={joinClassNames(styles.link, className)}
      data-force-hover={forceHover}
    >
      {children}
    </Link>
  )
}
