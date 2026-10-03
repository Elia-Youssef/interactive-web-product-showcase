import { describe, expect, it } from 'vitest'
import { readMarkerExtentTokens } from './markerExtentTokens'

// The token reader the facts take the marker extent from: it resolves the
// root-level tokens of the shipped stylesheet through their var()
// references into the viewer's own extent reader, so a token that changes
// shape or goes missing fails here, before a spec computes a fact with it.
describe('readMarkerExtentTokens', () => {
  it('reads a positive hit size and a non-negative ring reach from the token source', async () => {
    const extent = await readMarkerExtentTokens()

    expect(extent.markerHitPx).toBeGreaterThan(0)
    expect(extent.focusOutsetPx).toBeGreaterThanOrEqual(0)
  })
})
