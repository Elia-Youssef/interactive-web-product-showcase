import { useEffect } from 'react'
import { loadProgressPercent } from '@store/index'
import { useAppStoreApi } from '@store/index'
import { useLoadLedger } from './loadLedgerContext'

// The bridge between the stage's load ledger and the store's load progress:
// while a wait runs, every ledger change writes the whole percent the
// ledger's figure reads as, and only when that percent changed, so the
// store's subscribers re-render per percent at most, never per chunk. A
// wait that starts resets the ledger: the new wait's figure sums only its
// own bytes and starts from its own reads. The bridge owns no DOM and runs
// for every stage; a page that starts no wait writes nothing.
export function LoadProgressBridge(): null {
  const ledger = useLoadLedger()
  const store = useAppStoreApi()

  useEffect(() => {
    const mirror = () => {
      const { loadProgress, loadWaitProgress } = store.getState()
      if (loadProgress.wait.kind !== 'waiting') {
        return
      }
      const percent = loadProgressPercent(ledger.read().fraction)
      if (percent !== loadProgress.wait.percent) {
        loadWaitProgress(percent)
      }
    }
    let waiting = store.getState().loadProgress.wait.kind === 'waiting'
    const stopStore = store.subscribe(() => {
      const now = store.getState().loadProgress.wait.kind === 'waiting'
      if (now && !waiting) {
        ledger.reset()
        mirror()
      }
      waiting = now
    })
    const stopLedger = ledger.subscribe(mirror)
    return () => {
      stopStore()
      stopLedger()
    }
  }, [ledger, store])

  return null
}
