// The hotspot card: a surface with a hairline
// border, an eyebrow, a title and at most the manifest's bullet cap of
// bullets with red dot markers. It renders hotspot copy, so it inherits the
// cap from the product domain instead of repeating it. The close button
// carries hover and focus and must be named by the caller through
// closeLabel.
//
// The data-force-hover and data-force-focus attributes on the root exist
// for the dev-only gallery: they force the close button's states without a
// pointer or keyboard. App code never sets them.

import type { ComponentProps } from 'react'
import { HOTSPOT_BULLETS_MAX } from '@lib/product'
import { Eyebrow } from './Eyebrow'
import { CloseIcon } from './icons'
import styles from './Card.module.css'
import { joinClassNames } from './joinClassNames'

type CardBase = Omit<ComponentProps<'div'>, 'children' | 'title'>

export type CardProps = CardBase & {
  eyebrow: string
  title: string
  bullets: readonly string[]
  onClose: () => void
  closeLabel: string
}

export function Card({
  eyebrow,
  title,
  bullets,
  onClose,
  closeLabel,
  className,
  ...rest
}: CardProps) {
  if (bullets.length > HOTSPOT_BULLETS_MAX) {
    throw new Error(
      `Card takes at most ${HOTSPOT_BULLETS_MAX} bullets, but got ${bullets.length}`,
    )
  }

  return (
    <div className={joinClassNames(styles.card, className)} {...rest}>
      <button
        type="button"
        className={styles.close}
        aria-label={closeLabel}
        onClick={onClose}
      >
        <CloseIcon />
      </button>
      <Eyebrow>{eyebrow}</Eyebrow>
      <h2 className={styles.title}>{title}</h2>
      <ul className={styles.bullets} role="list">
        {bullets.map((bullet, index) => (
          <li key={index}>{bullet}</li>
        ))}
      </ul>
    </div>
  )
}
