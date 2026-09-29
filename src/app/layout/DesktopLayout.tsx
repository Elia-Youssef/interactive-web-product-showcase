// The desktop app shell: top bar header and main landmark wrapping the
// side panel and 3D stage. Slots are empty by default for parallel sprints.

import type { ReactNode } from 'react'
import { TopBar } from './TopBar'
import { Panel } from './Panel'
import { Stage } from './Stage'
import styles from './DesktopLayout.module.css'

export type DesktopLayoutProps = {
  readonly mark?: ReactNode
  readonly productIndex?: ReactNode
  readonly panel?: ReactNode
  readonly stage?: ReactNode
  readonly angleReadout?: ReactNode
  readonly stageControls?: ReactNode
}

export function DesktopLayout({
  mark,
  productIndex,
  panel,
  stage,
  angleReadout,
  stageControls,
}: DesktopLayoutProps = {}) {
  return (
    <div className={styles.layout}>
      <TopBar mark={mark} productIndex={productIndex} />
      <main className={styles.body}>
        <Panel>{panel}</Panel>
        <Stage angleReadout={angleReadout} stageControls={stageControls}>
          {stage}
        </Stage>
      </main>
    </div>
  )
}
