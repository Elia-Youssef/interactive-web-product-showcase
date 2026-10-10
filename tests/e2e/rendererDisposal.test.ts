import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { WebGPURenderer } from 'three/webgpu'

// Remove this proof when a three release carries the failed initialization
// disposal fix. It runs the installed renderer's real constructor and
// dispose method; only initialization is controlled, and the test runner
// also observes any unhandled rejection disposal leaves behind.
beforeEach(() => {
  vi.stubGlobal('document', {
    createElementNS: () => ({ width: 0, height: 0, style: {} }),
  })
})

afterEach(() => {
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

test.each([
  { forceWebGL: false, startup: 'not started' },
  { forceWebGL: false, startup: 'rejected' },
  { forceWebGL: true, startup: 'not started' },
  { forceWebGL: true, startup: 'rejected' },
])(
  'disposes a $startup renderer with forceWebGL=$forceWebGL without starting it',
  async ({ forceWebGL, startup }) => {
    const renderer = new WebGPURenderer({ forceWebGL })
    const failure = new Error('initialization rejected')
    let initCalls = 0
    renderer.init = async () => {
      initCalls += 1
      throw failure
    }
    if (startup === 'rejected') {
      await expect(renderer.init()).rejects.toBe(failure)
      initCalls = 0
    }

    const unhandled: unknown[] = []
    const record = (error: unknown) => unhandled.push(error)
    process.on('unhandledRejection', record)
    try {
      await renderer.dispose()
      // Node reports unhandled rejections at the turn boundary. Waiting for
      // that event turn proves disposal left no separate rejected promise.
      await new Promise<void>((resolve) => setImmediate(resolve))
    } finally {
      process.off('unhandledRejection', record)
    }

    expect(unhandled).toEqual([])
    expect(initCalls).toBe(0)
  },
)
