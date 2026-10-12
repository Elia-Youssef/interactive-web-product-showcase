// The hotspot card: a surface with a hairline
// border, an eyebrow, a title and at most the manifest's bullet cap of
// bullets with red dot markers. It renders hotspot copy, so it inherits the
// cap from the product domain instead of repeating it. The close button
// carries hover and focus and must be named by the caller through
// closeLabel. The card is a group named by its title, so a screen reader
// entering it hears what it is about; the title's heading level is the
// caller's, so the card fits the outline it renders in (an h2 on the
// stage, an h3 under a section heading).
//
// The data-force-hover and data-force-focus attributes on the root exist
// for the dev-only gallery: they force the close button's states without a
// pointer or keyboard. App code never sets them.

import { useId, type ComponentProps } from 'react'
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
  headingLevel?: 2 | 3
}

export function Card({
  eyebrow,
  title,
  bullets,
  onClose,
  closeLabel,
  headingLevel = 2,
  className,
  ...rest
}: CardProps) {
  const titleId = useId()
  if (bullets.length > HOTSPOT_BULLETS_MAX) {
    throw new Error(`Card takes at most ${HOTSPOT_BULLETS_MAX} bullets, but got ${bullets.length}`)
  }

  const Heading = headingLevel === 3 ? 'h3' : 'h2'
  return (
    <div
      className={joinClassNames(styles.card, className)}
      role="group"
      aria-labelledby={titleId}
      {...rest}
    >
      <button type="button" className={styles.close} aria-label={closeLabel} onClick={onClose}>
        <CloseIcon />
      </button>
      <Eyebrow>{eyebrow}</Eyebrow>
      <Heading id={titleId} className={styles.title}>
        {title}
      </Heading>
      <ul className={styles.bullets} role="list">
        {bullets.map((bullet, index) => (
          <li key={index}>{bullet}</li>
        ))}
      </ul>
    </div>
  )
}
