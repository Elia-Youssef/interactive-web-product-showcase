// The tracked uppercase label. Manifests write the copy in normal case: the
// CSS uppercases it, so screen readers read words instead of spelling out
// letters. A label that starts a section takes a heading level and renders
// as that heading, so a visitor navigating by headings lands on the
// section; without one it stays the paragraph it has always been.
//
// A label can close with a tail: a short fragment, such as a serial, that
// stays on one line with itself. The space before it is the label's last
// break opportunity, so the fragment never sits alone on a line, and a
// tailed label balances its lines, so a wrap lands inside the words and
// the tail keeps company. The tail is plain text of the same paragraph: the
// accessible text is the label and the tail, as written.

import type { ReactNode } from 'react'
import styles from './Eyebrow.module.css'
import { joinClassNames } from './joinClassNames'

export type EyebrowProps = {
  children: string
  // The heading level the label carries, when it starts a section. The
  // level is the page outline's, so the page's own heading order decides
  // it: the level is taken, never invented here.
  level?: 2 | 3 | 4 | 5 | 6
  // The fragment the label closes with, kept on one line.
  tail?: string
}

export function Eyebrow({ children, level, tail }: EyebrowProps) {
  const className =
    tail === undefined ? styles.eyebrow : joinClassNames(styles.eyebrow, styles.withTail)
  const content: ReactNode =
    tail === undefined ? (
      children
    ) : (
      <>
        {children}{' '}
        <span className={styles.tail} data-eyebrow-tail>
          {tail}
        </span>
      </>
    )
  switch (level) {
    case undefined:
      return <p className={className}>{content}</p>
    case 2:
      return <h2 className={className}>{content}</h2>
    case 3:
      return <h3 className={className}>{content}</h3>
    case 4:
      return <h4 className={className}>{content}</h4>
    case 5:
      return <h5 className={className}>{content}</h5>
    case 6:
      return <h6 className={className}>{content}</h6>
  }
}
