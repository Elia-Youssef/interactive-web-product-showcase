import { afterEach, expect, test, vi } from 'vitest'
import { renderToString } from 'react-dom/server'
import { AppStoreProvider } from './AppStoreProvider'
import { selectRendererStatus } from './slices/renderer'
import { useAppStore } from './useAppStore'

function StatusProbe() {
  const status = useAppStore(selectRendererStatus)

  return <p>{status.kind}</p>
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
