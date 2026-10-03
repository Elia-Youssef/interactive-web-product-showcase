// The text panel of the responsive layout: the dock, the product details slot
// and the site URL footer. On phone, becomes a bottom sheet surface with a
// grab handle. The dock is the layout's place for overlay content that
// leaves the stage, the open hotspot card on phone first: the composition
// takes the element through dockRef and renders into it. It sits first, so
// docked content shows at the top of the sheet. Words come from siteCopy.
// Primitives come from @ui.

import type { ReactNode, Ref } from 'react'
import { Readout } from '@ui/index'
import { siteCopy } from '@lib/copy/site'
import styles from './Panel.module.css'

export type PanelProps = {
  readonly children?: ReactNode
  readonly dockRef?: Ref<HTMLDivElement>
}

export function Panel({ children, dockRef }: PanelProps) {
  return (
    <aside className={styles.panel} aria-label={siteCopy.panelLabel}>
      <div className={styles.handle} aria-hidden="true" />
      <div ref={dockRef} className={styles.dock} data-slot="dock" />
      <div className={styles.content} data-slot="panel">
        {children}
      </div>
      <div className={styles.footer}>
        <Readout>{siteCopy.siteUrl}</Readout>
      </div>
    </aside>
  )
}
