// Joins the component's own class with an optional caller class, so a
// caller can add a class without replacing the component's styles. CSS
// module lookups read as possibly absent under noUncheckedIndexedAccess,
// so both inputs may be undefined.

export function joinClassNames(
  own: string | undefined,
  caller: string | undefined,
): string | undefined {
  if (own === undefined) {
    return caller
  }
  if (caller === undefined) {
    return own
  }
  return `${own} ${caller}`
}
