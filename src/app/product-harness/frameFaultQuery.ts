// The dev-only frame fault query parameters of the product harness, as a
// pure parse. A fault throws inside every frame that presents it, at one of
// the two places a frame runs content code: the present itself (an
// object's own render hook, the path a node build that throws takes) and a
// frame callback. Its scope says whose frames it breaks: the product's,
// mounted with the presented product, or the stage's, mounted beside the
// product in the stage's own content. Either rides the page's first
// product mount only, so a remount through the harness toggle is new,
// clean content. An unknown value is a named reason for the harness alert,
// never a guess.
export const harnessFrameFaultPlaces = ['present', 'callback'] as const
export type HarnessFrameFaultPlace = (typeof harnessFrameFaultPlaces)[number]

export const harnessFrameFaultScopes = ['product', 'stage'] as const
export type HarnessFrameFaultScope = (typeof harnessFrameFaultScopes)[number]

export type HarnessFrameFault = {
  readonly place: HarnessFrameFaultPlace
  readonly scope: HarnessFrameFaultScope
}

export type HarnessFrameFaultParse =
  | { readonly kind: 'none' }
  | { readonly kind: 'fault'; readonly fault: HarnessFrameFault }
  | { readonly kind: 'invalid'; readonly reason: string }

// The message every fault throws, naming where it threw.
export function frameFaultMessage(place: HarnessFrameFaultPlace): string {
  return `the harness ${place} fault threw inside a presented frame`
}

function oneOf<Value extends string>(values: readonly Value[], value: string): Value | null {
  return values.find((candidate) => candidate === value) ?? null
}

function invalid(name: string, value: string, values: readonly string[]): HarnessFrameFaultParse {
  return {
    kind: 'invalid',
    reason: `the ${name} parameter names nothing it accepts: ${value} (expected ${values.join(' or ')})`,
  }
}

export function harnessFrameFault(query: string): HarnessFrameFaultParse {
  const params = new URLSearchParams(query)
  const placeValue = params.get('frameFault')
  if (placeValue === null || placeValue === '') {
    return { kind: 'none' }
  }
  const place = oneOf(harnessFrameFaultPlaces, placeValue)
  if (place === null) {
    return invalid('frameFault', placeValue, harnessFrameFaultPlaces)
  }
  const scopeValue = params.get('frameFaultScope') ?? 'product'
  const scope = oneOf(harnessFrameFaultScopes, scopeValue)
  if (scope === null) {
    return invalid('frameFaultScope', scopeValue, harnessFrameFaultScopes)
  }
  return { kind: 'fault', fault: { place, scope } }
}
