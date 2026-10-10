import {
  applyLoadProgressEvent,
  initialLoadProgress,
  type LoadProgress,
  type LoadProgressEvent,
} from './loadProgress.logic'

export type { LoadProgress, LoadWait } from './loadProgress.logic'

export type LoadProgressSliceState = {
  loadProgress: LoadProgress
}

export type LoadProgressSlice = LoadProgressSliceState & {
  loadWaitStarted: () => void
  loadWaitProgress: (percent: number | null) => void
  loadWaitEnded: () => void
  loadReadoutRevealed: () => void
}

// The slice only ever writes its own fields, so it asks for a set narrowed
// to its own state. The full store's set satisfies this structurally.
type SetLoadProgressState = (
  updater: (state: LoadProgressSliceState) => Partial<LoadProgressSliceState>,
) => void

export function createLoadProgressSlice(set: SetLoadProgressState): LoadProgressSlice {
  const apply = (event: LoadProgressEvent) => {
    set((state) => ({ loadProgress: applyLoadProgressEvent(state.loadProgress, event) }))
  }

  return {
    loadProgress: initialLoadProgress,
    loadWaitStarted: () => apply({ kind: 'started' }),
    loadWaitProgress: (percent) => apply({ kind: 'progress', percent }),
    loadWaitEnded: () => apply({ kind: 'ended' }),
    loadReadoutRevealed: () => apply({ kind: 'revealed' }),
  }
}

// The figure the wait holds, or null while it holds none or no wait runs.
export function selectLoadWaitPercent(state: LoadProgressSliceState): number | null {
  return state.loadProgress.wait.kind === 'waiting' ? state.loadProgress.wait.percent : null
}

// How many times the readout has revealed, across the waits of this page.
export function selectLoadRevealCount(state: LoadProgressSliceState): number {
  return state.loadProgress.reveals
}
