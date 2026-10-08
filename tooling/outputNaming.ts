// The one definition of how the build names its hashed output. The Vite
// config feeds these values to the bundler, and the deploy check derives the
// shape of a hashed name from the same values, so what the bundler writes and
// what the check accepts cannot drift apart.

// The name patterns of the bundled files: a content hash of the given length
// sits between the name and the extension. Entries and chunks are always
// scripts, so their pattern spells the extension; assets keep their own.
export const hashLength = 8
// The characters the bundler may use in a hash: url-safe base64.
export const hashCharacters = 'base64'
export const scriptNamePattern = `assets/[name]-[hash:${hashLength}].js`
export const assetNamePattern = `assets/[name]-[hash:${hashLength}][extname]`
export const hashedNamePatterns = [scriptNamePattern, assetNamePattern] as const

const HASH_CHARACTER_CLASS = '[A-Za-z0-9_-]'

function escapeLiteral(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

// The pattern as a regular expression over a dist-relative path. Only the
// placeholders the pattern uses are translated; any other placeholder throws,
// so a pattern edit that the check cannot read fails loudly.
export function patternExpression(pattern: string): RegExp {
  const parts = pattern.split(/(\[[a-z]+(?::\d+)?\])/)
  const source = parts
    .map((part) => {
      const placeholder = /^\[([a-z]+)(?::(\d+))?\]$/.exec(part)
      if (placeholder === null) {
        return escapeLiteral(part)
      }
      const [, name, length] = placeholder
      switch (name) {
        case 'name':
          return '[^/]+'
        case 'extname':
          return '\\.[^/.]+'
        case 'hash':
          return `${HASH_CHARACTER_CLASS}{${length ?? hashLength}}`
        default:
          throw new Error(`the output name pattern uses an unknown placeholder: ${part}`)
      }
    })
    .join('')
  return new RegExp(`^${source}$`)
}

// Whether a dist-relative path is named by one of the build's patterns.
export function isHashedName(file: string): boolean {
  return hashedNamePatterns.some((pattern) => patternExpression(pattern).test(file))
}
