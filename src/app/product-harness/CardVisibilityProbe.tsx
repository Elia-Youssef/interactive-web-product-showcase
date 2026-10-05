import { useEffect, useMemo } from 'react'
import { selectExplodeReadout, selectSelectedHotspot, useAppStoreApi } from '@store/index'
import { useStageOverlay } from '@viewer/overlay/stageOverlayContext'
import { useLoadedProduct } from '@viewer/product/loadedProduct'
import { observeCardVisibility, type HarnessCardVisibilitySample } from './cardVisibilityObserver'

// The dev-only record of the open card against its marker, one sample per
// overlay pass, for the proof that the card shows exactly when its marker
// does, read through the window getters below. Dev-only, like the harness
// that mounts it.
export function CardVisibilityProbe() {
  const loaded = useLoadedProduct()
  const overlay = useStageOverlay()
  const store = useAppStoreApi()
  const slug = loaded.manifest.slug
  const record = useMemo(() => createSampleRecord(), [])

  useEffect(
    () =>
      observeCardVisibility(
        overlay,
        () => {
          const state = store.getState()
          const selected = selectSelectedHotspot(state, slug)
          return selected === null ? null : { selected, t: selectExplodeReadout(state, slug) }
        },
        record.add,
      ),
    [overlay, store, slug, record],
  )

  useEffect(() => {
    window.__harnessCardVisibilitySamples = record.read
    window.__harnessClearCardVisibilitySamples = record.clear
    return () => {
      if (window.__harnessCardVisibilitySamples === record.read) {
        delete window.__harnessCardVisibilitySamples
      }
      if (window.__harnessClearCardVisibilitySamples === record.clear) {
        delete window.__harnessClearCardVisibilitySamples
      }
    }
  }, [record])

  return null
}

type SampleRecord = {
  readonly add: (sample: HarnessCardVisibilitySample) => void
  readonly read: () => readonly HarnessCardVisibilitySample[]
  readonly clear: () => void
}

function createSampleRecord(): SampleRecord {
  const samples: HarnessCardVisibilitySample[] = []
  return {
    add: (sample) => {
      samples.push(sample)
    },
    read: () => [...samples],
    clear: () => {
      samples.length = 0
    },
  }
}

declare global {
  interface Window {
    __harnessCardVisibilitySamples?: () => readonly HarnessCardVisibilitySample[]
    __harnessClearCardVisibilitySamples?: () => void
  }
}
