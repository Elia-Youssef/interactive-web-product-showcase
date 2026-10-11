import { expect, test } from 'vitest'
import { renderToString } from 'react-dom/server'
import type { StoreApi } from 'zustand/vanilla'
import { AppStoreContext } from '@store/appStoreContext'
import { createAppStore, type AppState } from '@store/index'
import type { ProductTransitionPhase } from '@lib/transition'
import { LoadReadout } from './LoadReadout'

// The readout's own render, as static HTML: wanted, it is the site's
// loading word over a track, determinate or indeterminate by the wait's
// figure, and hidden it is not in the DOM at all. The readout is
// decorative: its root is aria-hidden, so nothing it holds joins the
// accessibility tree, and the only inline style it ever writes is the fill
// custom property.

// A store the test has acted on, provided through the store's own context.
// The static render reads a store's initial snapshot, so the acted state is
// also the initial one it answers: the scenario is the store's whole state.
function storeOf(act: (store: StoreApi<AppState>) => void): StoreApi<AppState> {
  const store = createAppStore()
  act(store)
  return { ...store, getInitialState: () => store.getState() }
}

function rendered(store: StoreApi<AppState>, phase: ProductTransitionPhase = 'idle'): string {
  return renderToString(
    <AppStoreContext.Provider value={store}>
      <LoadReadout phase={phase} />
    </AppStoreContext.Provider>,
  )
}

test('a fresh wait renders the loading word with no figure and no inline style', () => {
  const html = rendered(storeOf(() => undefined))

  expect(html).toContain('data-load-readout=""')
  expect(html).toContain('aria-hidden="true"')
  expect(html).toContain('Loading')
  expect(html).not.toContain('%')
  expect(html).not.toContain('style=')
})

test('a wait with a figure renders it, as the one inline style', () => {
  const html = rendered(
    storeOf((store) => {
      store.getState().loadWaitStarted()
      store.getState().loadWaitProgress(42)
    }),
  )

  expect(html).toContain('Loading 42%')
  expect(html.match(/style="/g)).toHaveLength(1)
  expect(html).toContain('--load-readout-fill:42%')
})

test('a switch phase renders nothing', () => {
  for (const phase of ['covering', 'covered', 'revealing'] as const) {
    expect(
      rendered(
        storeOf(() => undefined),
        phase,
      ),
    ).toBe('')
  }
})

test('a failed renderer renders nothing', () => {
  const html = rendered(
    storeOf((store) => {
      store.getState().rendererFailed('the backend request is invalid')
    }),
  )

  expect(html).toBe('')
})

test('a presented product renders nothing', () => {
  const html = rendered(
    storeOf((store) => {
      store.getState().productReady(
        'sample-one',
        {
          parts: [],
          hotspots: [],
          cameras: [],
          clip: { name: 'Explode', durationSeconds: 1 },
          variants: [],
        },
        { meshes: 1, triangles: 0, geometryBytes: 0, textureBytes: 0 },
      )
    }),
  )

  expect(html).toBe('')
})
