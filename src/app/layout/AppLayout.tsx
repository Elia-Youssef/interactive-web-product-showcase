// The responsive app shell: top bar header and main landmark wrapping the
// product panel and 3D stage. Optional slots keep the shell reusable;
// the panel's dock element and the stage chrome element reach the
// composition through dockRef and chromeRef.

import type { ReactNode, Ref } from 'react'
import { RaMark } from '@ui/index'
import { TopBar } from './TopBar'
import { Panel } from './Panel'
import { Stage } from './Stage'
import styles from './AppLayout.module.css'

export type AppLayoutProps = {
  readonly mark?: ReactNode
  readonly productIndex?: ReactNode
  readonly panel?: ReactNode
  readonly stage?: ReactNode
  readonly angleReadout?: ReactNode
  readonly stageControls?: ReactNode
  // The panel's dock element, handed to the composition that renders
  // docked overlay content into it.
  readonly dockRef?: Ref<HTMLDivElement>
  // The stage chrome element, handed to the composition whose overlay
  // content keeps clear of it.
  readonly chromeRef?: Ref<HTMLDivElement>
}

export function AppLayout({
  mark = <RaMark />,
  productIndex,
  panel,
  stage,
  angleReadout,
  stageControls,
  dockRef,
  chromeRef,
}: AppLayoutProps = {}) {
  return (
    <div className={styles.layout}>
      <TopBar mark={mark} productIndex={productIndex} />
      <main className={styles.body}>
        <Panel dockRef={dockRef}>{panel}</Panel>
        <Stage angleReadout={angleReadout} stageControls={stageControls} chromeRef={chromeRef}>
          {stage}
        </Stage>
      </main>
    </div>
  )
}
