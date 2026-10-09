// The one authority on file extensions. Every glob, include list and file
// filter in the repo derives from these lists: the ESLint files patterns, the
// layer gate, the Vitest include and the lint and format runners. Extending
// the project with a new source kind is an edit here, nowhere else.

// The extensions a source or test file may carry under src/. The project is
// TypeScript only: any other script or module file under src/ fails lint by
// name.
export const sourceExtensions = ['ts', 'tsx'] as const

// The base-name markers that make a file a test file of this repo. Wherever
// test files are meant, every runner's marker counts; each runner includes
// only its own when it decides what to run.
export const unitTestMarker = 'test'
export const specFileMarker = 'spec'
export const testFileMarkers = [unitTestMarker, specFileMarker] as const

// The base-name marker that makes a file a fixture module: test support that
// lives beside the code it stands in for, may import the dev packages like a
// test file, is never collected by a test runner, and is never imported by
// production code. The marker is its own file kind, not a test marker: a
// fixture module carries no tests, so importing one must not register any.
export const fixtureMarker = 'fixtures'

// A glob over the file markers, for the test and fixture file categories of
// the layer gate, the lint exemption globs and the vitest include.
export function testFileGlob(markers: readonly string[], extensions: readonly string[]): string {
  return `**/*.${globAlternation(markers)}.${extensionGlob(extensions)}`
}

// One glob segment matching any of the given alternatives. Brace expansion
// needs a comma: micromatch and minimatch read a one-element brace such as
// {tsx} as the literal characters, so a single alternative is written bare.
// Every glob built from a list goes through here.
export function globAlternation(alternatives: readonly string[]): string {
  const [first, ...rest] = alternatives
  if (first === undefined) {
    throw new Error('a glob alternation needs at least one alternative')
  }
  return rest.length === 0 ? first : `{${alternatives.join(',')}}`
}

// The source extensions that carry JSX syntax. ESLint must parse them with
// JSX enabled, and every JSX parser mapping derives from this list.
export const jsxExtensions = ['tsx'] as const

// Every extension ESLint must parse and lint, inside src/ and outside it. It
// covers sourceExtensions plus the script kinds that must be reported when
// they appear under src/, and still lint cleanly when they belong to owned
// tooling.
export const scriptExtensions = ['ts', 'tsx', 'js', 'jsx', 'mjs', 'cjs', 'mts', 'cts'] as const

// The extensions a stylesheet of this repo carries. The stylesheet scans,
// the raw design value gate and the focus ring, derive their file list from
// this list, so a stylesheet in a new folder is scanned the moment git
// owns it.
export const styleExtensions = ['css'] as const

// What the formatter owns. YAML stays out on purpose: the project authors no
// yaml file, and the one it tracks, the lockfile, is generated.
export const formatExtensions = [
  'ts',
  'tsx',
  'js',
  'jsx',
  'mjs',
  'cjs',
  'mts',
  'cts',
  'json',
  'css',
  'html',
  'md',
] as const

// The extensions of the binary files the project ships. A gate that reads
// text skips these by name and reads everything else, so a text file can
// never leave a gate's reach by the bytes it happens to hold; a new binary
// kind is an edit here, and until then a gate reports it by name.
export const binaryExtensions = [
  'png',
  'jpg',
  'jpeg',
  'webp',
  'avif',
  'gif',
  'ico',
  'woff',
  'woff2',
  'ttf',
  'otf',
  'glb',
  'ktx2',
  'hdr',
] as const

export function extensionOf(file: string): string {
  const dot = file.lastIndexOf('.')
  return dot === -1 ? '' : file.slice(dot + 1)
}

export function hasExtension(file: string, extensions: readonly string[]): boolean {
  return extensions.includes(extensionOf(file))
}

// A glob segment over the extensions, for config `files` patterns and test
// includes alike.
export function extensionGlob(extensions: readonly string[]): string {
  return globAlternation(extensions)
}
