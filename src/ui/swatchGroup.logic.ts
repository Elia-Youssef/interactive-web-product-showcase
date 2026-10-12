// The key handling of a single-choice group, per the ARIA radio pattern:
// the arrow keys step through the choices with wrap, Home and End jump to
// the ends, and every other key moves nothing. Pure index math, fully unit
// tested, so the group's component stays render and wiring alone.

export function radioKeyTarget(key: string, index: number, count: number): number | null {
  if (count === 0 || index < 0 || index >= count) {
    return null
  }
  if (key === 'Home') {
    return 0
  }
  if (key === 'End') {
    return count - 1
  }
  const step = stepOf(key)
  if (step === null) {
    return null
  }
  return (index + step + count) % count
}

// How far the key steps, or null for a key the pattern does not bind.
function stepOf(key: string): number | null {
  switch (key) {
    case 'ArrowDown':
    case 'ArrowRight':
      return 1
    case 'ArrowUp':
    case 'ArrowLeft':
      return -1
    default:
      return null
  }
}
