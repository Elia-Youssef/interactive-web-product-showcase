// The load progress of the stage's wait: the whole-percent figure the
// viewer's byte ledger writes while a wait runs, and the count of the
// readout's reveals, which survives the wait it belongs to so the next
// wait's reveal is still a change the announcement derivation can see. The
// figure never rides the product status: its readers subscribe here alone,
// so the product's own subscribers never re-render per chunk.

export type LoadWait = { kind: 'idle' } | { kind: 'waiting'; percent: number | null }

export type LoadProgress = {
  readonly wait: LoadWait
  readonly reveals: number
}

export type LoadProgressEvent =
  | { kind: 'started' }
  | { kind: 'progress'; percent: number | null }
  | { kind: 'ended' }
  | { kind: 'revealed' }

export const initialLoadProgress: LoadProgress = { wait: { kind: 'idle' }, reveals: 0 }

// Pure transition from (state, event) to the next state. A progress event
// lands only on a running wait, and only when it changes the figure: the
// writer may be told per chunk, the store never tells its subscribers per
// chunk.
export function applyLoadProgressEvent(
  state: LoadProgress,
  event: LoadProgressEvent,
): LoadProgress {
  switch (event.kind) {
    case 'started':
      return state.wait.kind === 'waiting'
        ? state
        : { ...state, wait: { kind: 'waiting', percent: null } }
    case 'progress':
      return state.wait.kind !== 'waiting' || state.wait.percent === event.percent
        ? state
        : { ...state, wait: { kind: 'waiting', percent: event.percent } }
    case 'ended':
      return state.wait.kind === 'idle' ? state : { ...state, wait: { kind: 'idle' } }
    case 'revealed':
      return { ...state, reveals: state.reveals + 1 }
  }
}

// The whole percent a fraction of the wait's bytes reads as, or null while
// it reads none. The floor never rounds a share up to a claim it has not
// reached; the share itself never reaches done while it shows, because the
// ledger holds no figure once no wanted transfer still lacks bytes.
export function loadProgressPercent(fraction: number | null): number | null {
  if (fraction === null) {
    return null
  }
  return Math.floor(fraction * 100)
}
