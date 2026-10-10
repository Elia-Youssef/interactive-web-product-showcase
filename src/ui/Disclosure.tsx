// The disclosure: a section heading whose whole text is one button that
// shows and hides the content under it. The button carries aria-expanded,
// and aria-controls names the content while it is shown. Closed means
// absent: the content mounts only while the disclosure is expanded, so a
// closed disclosure costs one tab stop and repeats nothing in the
// accessibility tree. The caller owns the expanded state, so it can act on
// a close, and names the heading level, so the section fits the outline it
// renders in. The label copy comes from the caller.
//
// The data-force-hover and data-force-focus attributes on the root exist
// for the dev-only gallery: they force the button's states without a
// pointer or keyboard. App code never sets them.

import { useId, type ComponentProps, type ReactNode } from 'react'
import { ChevronDownIcon, ChevronUpIcon } from './icons'
import styles from './Disclosure.module.css'
import { joinClassNames } from './joinClassNames'

type DisclosureBase = Omit<ComponentProps<'div'>, 'children'>

export type DisclosureProps = DisclosureBase & {
  label: string
  expanded: boolean
  onToggle: () => void
  headingLevel?: 2 | 3
  children: ReactNode
}

export function Disclosure({
  label,
  expanded,
  onToggle,
  headingLevel = 2,
  children,
  className,
  ...rest
}: DisclosureProps) {
  const contentId = useId()
  const Heading = headingLevel === 3 ? 'h3' : 'h2'
  return (
    <div className={joinClassNames(styles.disclosure, className)} {...rest}>
      <Heading className={styles.heading}>
        <button
          type="button"
          className={styles.button}
          aria-expanded={expanded}
          aria-controls={expanded ? contentId : undefined}
          onClick={onToggle}
        >
          {label}
          {expanded ? <ChevronUpIcon /> : <ChevronDownIcon />}
        </button>
      </Heading>
      {expanded && <div id={contentId}>{children}</div>}
    </div>
  )
}
