import { describe, expect, it } from 'vitest'
import { devClientStubResponse } from './devClientStub.ts'

describe('the dev client stub', () => {
  it('answers the client entry request and lets every other URL through', () => {
    expect(devClientStubResponse('/@vite/client'), 'the entry serves the stub').toBeTruthy()
    expect(devClientStubResponse('/@vite/client?t=1'), 'the query is not the address').toBeTruthy()
    expect(devClientStubResponse('/@vite/env')).toBeNull()
    expect(devClientStubResponse('/src/app/App.tsx')).toBeNull()
    expect(devClientStubResponse('/')).toBeNull()
  })

  it('exports the surface the served modules import', () => {
    const stub = devClientStubResponse('/@vite/client') ?? ''
    for (const exported of ['createHotContext', 'updateStyle', 'removeStyle', 'injectQuery']) {
      expect(stub, `the stub must export ${exported}`).toContain(`export function ${exported}`)
    }
  })

  it('serves no socket and no reconnect polling anywhere in the stub', () => {
    const stub = devClientStubResponse('/@vite/client') ?? ''
    expect(stub).not.toContain('WebSocket')
    expect(stub).not.toContain('connect')
  })
})
