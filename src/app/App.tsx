import { AppStoreProvider } from '@store/index'
import { Stage } from '@viewer/Stage'
import styles from './App.module.css'

// The composition of the page: one store around one stage. Until a page
// layout owns them, the app supplies the main landmark and the full-viewport
// frame the stage fills.
export function App() {
  return (
    <AppStoreProvider>
      <main className={styles.viewportFrame}>
        <Stage />
      </main>
    </AppStoreProvider>
  )
}
