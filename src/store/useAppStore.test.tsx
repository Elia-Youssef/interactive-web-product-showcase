import { afterEach, expect, test, vi } from 'vitest'
import { renderToString } from 'react-dom/server'
import type { StoreApi } from 'zustand/vanilla'
import { AppStoreProvider } from './AppStoreProvider'
import { selectRendererStatus } from './slices/renderer'
import { useAppStore, useAppStoreApi } from './useAppStore'
import type { AppState } from './createAppStore'

function StatusProbe() {
  const status = useAppStore(selectRendererStatus)

  return <p>{status.kind}</p>
}

function StoreApiProbe({ onStore }: { readonly onStore: (store: StoreApi<AppState>) => void }) {
  const store = useAppStoreApi()
  onStore(store)

  return <p>{store.getState().rendererStatus.kind}</p>
}

afterEach(() => {
  vi.restoreAllMocks()
})

test('useAppStore reads the store the provider created', () => {
  const html = renderToString(
    <AppStoreProvider>
      <StatusProbe />
    </AppStoreProvider>,
  )

  expect(html).toContain('initializing')
})

test('useAppStore outside AppStoreProvider throws the named error', () => {
  vi.spyOn(console, 'error').mockImplementation(() => {})

  expect(() => renderToString(<StatusProbe />)).toThrowError(/AppStoreProvider/)
})

test('useAppStoreApi exposes the provider store, and its state drives subscribers', () => {
  // A holder, not a bare let: the probe assigns from inside its render, and
  // the check below reads the captured instance after the render returns.
  const captured: { store: StoreApi<AppState> | null } = { store: null }

  const html = renderToString(
    <AppStoreProvider>
      <StoreApiProbe onStore={(store) => (captured.store = store)} />
    </AppStoreProvider>,
  )

  // The probe rendered the state of the instance it captured.
  expect(html).toContain('initializing')
  const exposed = captured.store
  if (exposed === null) {
    throw new Error('the probe never captured the store instance')
  }
  exposed.getState().rendererReady('webgpu')
  expect(exposed.getState().rendererStatus).toEqual({ kind: 'ready', backend: 'webgpu' })
})

test('useAppStoreApi outside AppStoreProvider throws the named error', () => {
  vi.spyOn(console, 'error').mockImplementation(() => {})

  expect(() => renderToString(<StoreApiProbe onStore={() => undefined} />)).toThrowError(
    /AppStoreProvider/,
  )
})
