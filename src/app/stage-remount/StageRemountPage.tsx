import { useState } from 'react'
import { AppStoreProvider, selectRendererStatus, useAppStore } from '@store/index'
import { Stage } from '@viewer/Stage'
import appStyles from '../App.module.css'
import styles from './StageRemountPage.module.css'

// The dev-only page the remount spec drives: one store for the page's whole
// life, and a stage the toggle unmounts and mounts again under that store
// (its clock, renderer and automation hook included). The store's renderer
// status is shown outside the stage, so the spec reads the unmounted state as
// a stable fact instead of racing a transient one. The production build never
// emits this page: its only input is index.html.
export function StageRemountPage() {
  const [mounted, setMounted] = useState(true)

  return (
    <AppStoreProvider>
      <main className={appStyles.viewportFrame}>
        {mounted && <Stage />}
        <div className={styles.controls}>
          <button
            type="button"
            data-testid="toggle-stage"
            onClick={() => setMounted((isMounted) => !isMounted)}
          >
            {mounted ? 'Unmount the stage' : 'Mount the stage'}
          </button>
          <RendererStatusReadout />
        </div>
      </main>
    </AppStoreProvider>
  )
}

function RendererStatusReadout() {
  const status = useAppStore(selectRendererStatus)
  return <output data-testid="renderer-status">{status.kind}</output>
}
