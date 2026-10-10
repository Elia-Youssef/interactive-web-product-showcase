// The facts readers cache their results per process, so one caller's
// accidental write to a returned fact would change what every later caller
// in the process sees. Freezing the returned facts closes that class: the
// cached objects and their arrays and tuples come back immutable.
//
// The freeze walks own properties without reading them, so a lazy getter
// stays lazy: the hotspot hiding heights stay unevaluated until a caller
// asks, which is what keeps the listing specs off the hiding-height search.
//
// A Map cannot be frozen: Object.freeze stops none of its mutators, so set
// and delete keep working on a frozen Map. What protects a cached Map is
// its ReadonlyMap type in the facts, and its values, which the reader
// freezes before they go in.

export function frozen<T>(value: T): T {
  freezeValue(value)
  return value
}

// Freezes one object or array without walking it, for the containers whose
// elements are live objects the freeze must not touch: the occluder meshes
// the raycasters share.
export function frozenShallow<T extends object>(value: T): T {
  Object.freeze(value)
  return value
}

function freezeValue(value: unknown): void {
  if (value === null || typeof value !== 'object') {
    return
  }
  Object.freeze(value)
  for (const descriptor of Object.values(Object.getOwnPropertyDescriptors(value))) {
    if ('get' in descriptor) {
      continue
    }
    freezeValue(descriptor.value)
  }
}
