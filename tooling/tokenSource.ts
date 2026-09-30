// The one stylesheet where literal design values may be written. Every
// other owned stylesheet reaches its colors, sizes and durations through
// the tokens defined there, so the raw
// design value gate exempts exactly this path and no other.
export const tokenSourcePath = 'src/styles/tokens.css'

// Git lists paths POSIX style, so the comparison normalizes the separators
// instead of trusting every caller to do it.
export function isTokenSource(path: string): boolean {
  return path.replaceAll('\\', '/') === tokenSourcePath
}
