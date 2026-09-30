// The top bar of the desktop layout: wordmarks, collection title and product index.
// Words come from siteCopy. Primitives come from @ui.

import type { ReactNode } from 'react'
import { Eyebrow } from '@ui/index'
import { siteCopy } from '@lib/copy/site'
import styles from './TopBar.module.css'

export type TopBarProps = {
  readonly mark?: ReactNode
  readonly productIndex?: ReactNode
}

export function TopBar({ mark, productIndex }: TopBarProps) {
  return (
    <header className={styles.topBar}>
      <div className={styles.left}>
        <div className={styles.mark} data-slot="mark">
          {mark}
        </div>
        <Eyebrow>{siteCopy.studioName}</Eyebrow>
      </div>
      <div className={styles.right}>
        <Eyebrow>{siteCopy.collectionName}</Eyebrow>
        {productIndex !== undefined && (
          <div className={styles.productIndex} data-slot="product-index">
            {productIndex}
          </div>
        )}
      </div>
    </header>
  )
}
