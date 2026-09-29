import { useState } from 'react'
import { AppStoreProvider } from '@store/index'
import { Stage } from '@viewer/Stage'
import appStyles from '../App.module.css'
import styles from './StageRemountPage.module.css'

// The dev-only page the remount spec drives: one store for the page's whole
// life around a stage keyed by a counter, so bumping the key remounts the
// stage (its clock, renderer and automation hook included) under the same
// store. The production build never emits this page: its only input is
// index.html.
export function StageRemountPage() {
  const [stageKey, setStageKey] = useState(0)

  return (
    <AppStoreProvider>
      <main className={appStyles.viewportFrame}>
        <Stage key={stageKey} />
        <button
          type="button"
          className={styles.remount}
          data-testid="remount-stage"
          onClick={() => setStageKey((key) => key + 1)}
        >
          Remount the stage
        </button>
      </main>
    </AppStoreProvider>
  )
}
