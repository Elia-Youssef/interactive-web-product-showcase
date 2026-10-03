import { describe, expect, it } from 'vitest'
import {
  harnessFrameFault,
  harnessFrameFaultPlaces,
  harnessFrameFaultScopes,
} from './frameFaultQuery'

function invalidReason(query: string): string {
  const parse = harnessFrameFault(query)
  if (parse.kind !== 'invalid') {
    throw new Error(`the query ${query} must be invalid`)
  }
  return parse.reason
}

describe('harnessFrameFault', () => {
  it('names no fault without the parameter or with an empty one', () => {
    expect(harnessFrameFault('?slug=sample-one')).toEqual({ kind: 'none' })
    expect(harnessFrameFault('?frameFault=')).toEqual({ kind: 'none' })
  })

  it.each(harnessFrameFaultPlaces)(
    'parses the %s place in the product scope by default',
    (place) => {
      expect(harnessFrameFault(`?frameFault=${place}`)).toEqual({
        kind: 'fault',
        fault: { place, scope: 'product' },
      })
    },
  )

  it.each(harnessFrameFaultScopes)('parses the %s scope', (scope) => {
    expect(harnessFrameFault(`?frameFault=callback&frameFaultScope=${scope}`)).toEqual({
      kind: 'fault',
      fault: { place: 'callback', scope },
    })
  })

  it('names an unknown place and the places it accepts', () => {
    const reason = invalidReason('?frameFault=gpu')
    expect(reason).toContain('gpu')
    for (const place of harnessFrameFaultPlaces) {
      expect(reason).toContain(place)
    }
  })

  it('names an unknown scope and the scopes it accepts', () => {
    const reason = invalidReason('?frameFault=present&frameFaultScope=page')
    expect(reason).toContain('page')
    for (const scope of harnessFrameFaultScopes) {
      expect(reason).toContain(scope)
    }
  })
})
