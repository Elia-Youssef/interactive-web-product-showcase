// The dev-only frame fault query parameters of the product harness, as a
// pure parse. A fault throws inside every frame that presents it, at one of
// the places a frame runs code: the present itself (an object's own render
// hook, the path a node build that throws takes), a frame callback, and the
// stage camera's own frame step, armed once the product is presented. Its
// scope says whose frames it breaks: the product's, mounted with the
// presented product, or the stage's, mounted beside the product in the
// stage's own content. The camera is the stage's code, so its fault takes
// the stage scope, by default and only. Every fault rides the page's first
// product mount only, so a remount through the harness toggle is new, clean
// content. An unknown value is a named reason for the harness alert, never
// a guess.
// The places whose fault takes either scope, and every place.
export const harnessScopedFaultPlaces = ['present', 'callback'] as const
export const harnessFrameFaultPlaces = [...harnessScopedFaultPlaces, 'camera'] as const
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

// The scopes a camera fault may name: the stage's alone, whose code the
// camera is.
const cameraFaultScopes = ['stage'] as const satisfies readonly HarnessFrameFaultScope[]

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
  const scopes = place === 'camera' ? cameraFaultScopes : harnessFrameFaultScopes
  const scopeValue = params.get('frameFaultScope') ?? scopes[0]
  const scope = oneOf(scopes, scopeValue)
  if (scope === null) {
    return invalid('frameFaultScope', scopeValue, scopes)
  }
  return { kind: 'fault', fault: { place, scope } }
}
