// The tracked uppercase label. Manifests write the copy in normal case: the
// CSS uppercases it, so screen readers read words instead of spelling out
// letters. A label that starts a section takes a heading level and renders
// as that heading, so a visitor navigating by headings lands on the
// section; without one it stays the paragraph it has always been.

import styles from './Eyebrow.module.css'

export type EyebrowProps = {
  children: string
  // The heading level the label carries, when it starts a section. The
  // level is the page outline's, so the page's own heading order decides
  // it: the level is taken, never invented here.
  level?: 2 | 3 | 4 | 5 | 6
}

export function Eyebrow({ children, level }: EyebrowProps) {
  switch (level) {
    case undefined:
      return <p className={styles.eyebrow}>{children}</p>
    case 2:
      return <h2 className={styles.eyebrow}>{children}</h2>
    case 3:
      return <h3 className={styles.eyebrow}>{children}</h3>
    case 4:
      return <h4 className={styles.eyebrow}>{children}</h4>
    case 5:
      return <h5 className={styles.eyebrow}>{children}</h5>
    case 6:
      return <h6 className={styles.eyebrow}>{children}</h6>
  }
}
