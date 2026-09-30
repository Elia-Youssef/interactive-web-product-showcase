// The tracked uppercase label. Manifests write the
// copy in normal case: the CSS uppercases it, so screen readers read words
// instead of spelling out letters.

import styles from './Eyebrow.module.css'

export type EyebrowProps = {
  children: string
}

export function Eyebrow({ children }: EyebrowProps) {
  return <p className={styles.eyebrow}>{children}</p>
}
