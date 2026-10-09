import { useCallback, useLayoutEffect, useState } from 'react'
import type { ProductSettleOutcome } from '@lib/product-switch'
import { useAppStoreApi } from '@store/index'
import type { ViewerModel } from '@viewer/automation/viewerAutomation'

export type HarnessProductReport = {
  readonly outcome: ProductSettleOutcome
  readonly renderedFrames: number
  readonly failedAtFrame: number | null
  readonly model: ViewerModel | null
}

// The dev-only harness records the actual product callback, including the
// recorded-frame count at the store's immediate failure. A later page poll
// cannot substitute for the instant the product lets its owner reveal it.
export function useHarnessProductReports(): (outcome: ProductSettleOutcome) => void {
  const store = useAppStoreApi()
  const [recording] = useState<{
    reports: HarnessProductReport[]
    failedAtFrame: number | null
  }>(() => ({
    reports: [],
    failedAtFrame: null,
  }))

  useLayoutEffect(() => {
    window.__harnessProductReports = recording.reports
    const unsubscribe = store.subscribe((state, previous) => {
      if (state.productStatus === previous.productStatus) {
        return
      }
      if (state.productStatus.kind === 'loading') {
        recording.failedAtFrame = null
      } else if (state.productStatus.kind === 'failed') {
        recording.failedAtFrame = window.__viewer?.renderedFrames ?? -1
      }
    })
    return () => {
      unsubscribe()
      if (window.__harnessProductReports === recording.reports) {
        delete window.__harnessProductReports
      }
    }
  }, [recording, store])

  return useCallback(
    (outcome) => {
      const viewer = window.__viewer
      if (viewer === undefined) {
        throw new Error('the harness product report needs the stage automation')
      }
      recording.reports.push({
        outcome,
        renderedFrames: viewer.renderedFrames,
        failedAtFrame: recording.failedAtFrame,
        model: viewer.model,
      })
    },
    [recording],
  )
}

declare global {
  interface Window {
    __harnessProductReports?: readonly HarnessProductReport[]
  }
}
