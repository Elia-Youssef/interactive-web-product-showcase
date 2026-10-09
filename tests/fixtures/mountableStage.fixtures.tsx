import { createElement, useState } from 'react'
import type { Stage, StageProps } from '../../src/viewer/Stage'
import styles from '../../src/app/product-harness/ProductHarnessPage.module.css'

type MountableStageProps = {
  readonly component: typeof Stage
  readonly props: StageProps
}

// The harness test can end the real stage owner without leaving the
// document. The control stays outside the stage it mounts and releases.
function MountableStage({ component, props }: MountableStageProps) {
  const [mounted, setMounted] = useState(true)
  const Component = component
  return (
    <>
      {mounted && <Component {...props} />}
      <div className={styles.controls} data-harness-control>
        <button
          type="button"
          data-testid="remount-stage"
          onClick={() => setMounted((current) => !current)}
        >
          {mounted ? 'Unmount the stage' : 'Mount the stage'}
        </button>
      </div>
    </>
  )
}

export function renderMountableStage(component: typeof Stage, props: StageProps) {
  return createElement(MountableStage, { component, props })
}
