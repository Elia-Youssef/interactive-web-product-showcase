// The one normalization every failure channel shares: a rejection of
// unknown kind becomes an Error, so a typed failure path never has to
// re-guess what arrived. Pure: no React, no three, nothing else from src/.

// The Error itself passes through untouched, so identity checks on a known
// failure keep working; anything else becomes an Error carrying its text.
export function asError(value: unknown): Error {
  return value instanceof Error ? value : new Error(String(value))
}
