// The text panel of the desktop layout: product details slot and site URL footer.
// Words come from siteCopy. Primitives come from @ui.

import type { ReactNode } from 'react'
import { Readout } from '@ui/index'
import { siteCopy } from '@lib/copy/site'
import styles from './Panel.module.css'

export type PanelProps = {
  readonly children?: ReactNode
}

export function Panel({ children }: PanelProps) {
  return (
    <aside className={styles.panel} aria-label={siteCopy.panelLabel}>
      <div className={styles.content} data-slot="panel">
        {children}
      </div>
      <div className={styles.footer}>
        <Readout>{siteCopy.siteUrl}</Readout>
      </div>
    </aside>
  )
}
