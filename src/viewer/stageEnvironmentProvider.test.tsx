import { Suspense } from 'react'
import { renderToPipeableStream } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'
import { HDRLoader } from 'three/examples/jsm/loaders/HDRLoader.js'
import { DataTexture } from 'three/webgpu'
import { ResourceHolds } from '@lib/async/resourceHolds'
import { StageHoldsContext } from './stageHoldsContext'
import { StageEnvironmentProvider } from './stageEnvironmentProvider'

function Uncommitted(): never {
  throw new Promise(() => undefined)
}

describe('StageEnvironmentProvider', () => {
  it('starts no HDR work for a concurrent render abandoned before commit', async () => {
    const texture = new DataTexture()
    const fetch = vi.spyOn(HDRLoader.prototype, 'loadAsync').mockResolvedValue(texture)
    const dispose = vi.spyOn(texture, 'dispose')
    const holds = new ResourceHolds<object>(queueMicrotask)
    let abort: () => void = () => undefined
    const shell = new Promise<void>((resolve) => {
      const stream = renderToPipeableStream(
        <Suspense fallback={null}>
          <StageHoldsContext.Provider value={holds}>
            <StageEnvironmentProvider file="/env/test.hdr">
              <Uncommitted />
            </StageEnvironmentProvider>
          </StageHoldsContext.Provider>
        </Suspense>,
        { onShellReady: resolve, onError: () => undefined },
      )
      abort = () => stream.abort()
    })
    try {
      await shell
      abort()
      expect(fetch).not.toHaveBeenCalled()
      expect(dispose).not.toHaveBeenCalled()
    } finally {
      fetch.mockRestore()
    }
  })
})
