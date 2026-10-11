import { expect, test, vi } from 'vitest'
import { renderToString } from 'react-dom/server'
import { useEscapeLayer } from './useEscapeLayer'

// A layer that registers for the whole render, the way an open surface
// would: the hook's context read is what this test drives, and effects
// never run in a static render, so the owner itself is never touched.
function OpenLayer() {
  useEscapeLayer(true, () => undefined)
  return <p>layer</p>
}

test('useEscapeLayer outside an escape provider throws the named error', () => {
  vi.spyOn(console, 'error').mockImplementation(() => undefined)

  expect(() => renderToString(<OpenLayer />)).toThrowError(/escape provider/)
})
