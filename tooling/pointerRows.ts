// The planted rows for the pointer rules, and the single list the test
// iterates. Every needle is assembled from parts at runtime, so no whole
// pointer to local-only material appears in this file: the gate scans its
// own test sources too.
import type { LocalOnlyEntry } from './localOnlyPaths.ts'
import type { PointerKind } from './pointerRules.ts'

export type ExpectedPointerFinding = {
  readonly line: number
  readonly column: number
  readonly kind: PointerKind
  readonly literal: string
}

export type PointerRow = {
  readonly title: string
  readonly text: string
  // The path the rules scan under, when the row is not about the default one
  readonly path?: string
  readonly localOnlyEntries: readonly LocalOnlyEntry[]
  readonly ownedFiles: readonly string[]
  // The findings in position order; empty means the planted text passes
  readonly expected: readonly ExpectedPointerFinding[]
}

// The path every default row is scanned under.
export const plantedPath = 'tooling/planted.ts'

// The needles and the entries they point at, assembled so this file never
// holds one whole.
const docsFolder: LocalOnlyEntry = { type: 'folder', value: ['do', 'cs/'].join('') }
const plantedFile: LocalOnlyEntry = { type: 'file', value: ['planted', '-file', '.ext'].join('') }
const decisionNeedle = ['decision', ' ', '32'].join('')
const upperDecisionNeedle = ['Decision', ' ', '7'].join('')
const otherDecisionNeedle = ['decision', ' ', '9'].join('')
export const taskIdNeedle = ['S', '4', '-03'].join('')
const introReference = ['intro', '.md'].join('')
const handbookReference = ['hand', 'book', '.md'].join('')
const handbookOwned = ['guide/hand', 'book', '.md'].join('')

const docsEntries: readonly LocalOnlyEntry[] = [docsFolder]

export const allPointerRows: readonly PointerRow[] = [
  {
    title: 'a folder entry after whitespace is a finding',
    text: ['see ', docsFolder.value, 'plan for it'].join(''),
    localOnlyEntries: docsEntries,
    ownedFiles: [],
    expected: [{ line: 1, column: 5, kind: 'local-path', literal: docsFolder.value }],
  },
  {
    title: 'a file entry inside quotes is a finding',
    text: ['"', plantedFile.value, '" names it'].join(''),
    localOnlyEntries: [plantedFile],
    ownedFiles: [],
    expected: [{ line: 1, column: 2, kind: 'local-path', literal: plantedFile.value }],
  },
  {
    title: 'a folder entry after an explicit relative step is a finding',
    text: ['the ./', docsFolder.value, 'x path'].join(''),
    localOnlyEntries: docsEntries,
    ownedFiles: [],
    expected: [{ line: 1, column: 7, kind: 'local-path', literal: docsFolder.value }],
  },
  {
    title: 'a longer path around a file entry stays clean',
    text: [['x', plantedFile.value].join(''), [plantedFile.value, '.bak'].join('')].join('\n'),
    localOnlyEntries: [plantedFile],
    ownedFiles: [],
    expected: [],
  },
  {
    title: 'a URL path into the folder stays clean',
    text: ['https://threejs.org/', docsFolder.value, ' is the reference'].join(''),
    localOnlyEntries: docsEntries,
    ownedFiles: [],
    expected: [],
  },
  {
    title: 'a hyphenated folder name stays clean',
    text: ['the my-', docsFolder.value, ' folder'].join(''),
    localOnlyEntries: docsEntries,
    ownedFiles: [],
    expected: [],
  },
  {
    title: 'an identifier holding the folder name stays clean',
    text: 'const docsUrl = buildDocsUrl()',
    localOnlyEntries: docsEntries,
    ownedFiles: [],
    expected: [],
  },
  {
    title: 'the plural word without a number stays clean',
    text: 'the decisions are recorded elsewhere',
    localOnlyEntries: [],
    ownedFiles: [],
    expected: [],
  },
  {
    title: 'a decision shorthand with its number is a finding',
    text: ['as ', decisionNeedle, ' says'].join(''),
    localOnlyEntries: [],
    ownedFiles: [],
    expected: [{ line: 1, column: 4, kind: 'decision', literal: decisionNeedle }],
  },
  {
    title: 'the same shorthand in upper case is a finding',
    text: [upperDecisionNeedle, ' locks it'].join(''),
    localOnlyEntries: [],
    ownedFiles: [],
    expected: [{ line: 1, column: 1, kind: 'decision', literal: upperDecisionNeedle }],
  },
  {
    title: 'a task label is a finding',
    text: ['shipped in ', taskIdNeedle, ' today'].join(''),
    localOnlyEntries: [],
    ownedFiles: [],
    expected: [{ line: 1, column: 12, kind: 'task-id', literal: taskIdNeedle }],
  },
  {
    title: 'a longer hyphenated label stays clean',
    text: [taskIdNeedle, '9 and counting'].join(''),
    localOnlyEntries: [],
    ownedFiles: [],
    expected: [],
  },
  {
    title: 'the texture compression acronym stays clean',
    text: 'S3TC texture compression',
    localOnlyEntries: [],
    ownedFiles: [],
    expected: [],
  },
  {
    title: 'the material variants extension stays clean',
    text: 'KHR_materials_variants switch',
    localOnlyEntries: [],
    ownedFiles: [],
    expected: [],
  },
  {
    title: 'a markdown reference that resolves nowhere is a finding',
    text: ['see ', introReference, ' first'].join(''),
    localOnlyEntries: [],
    ownedFiles: [],
    expected: [{ line: 1, column: 5, kind: 'markdown', literal: introReference }],
  },
  {
    title: 'a markdown reference to a listed file stays clean',
    path: 'guide/intro.ts',
    text: ['the ', handbookReference, ' covers it'].join(''),
    localOnlyEntries: [],
    ownedFiles: [handbookOwned],
    expected: [],
  },
  {
    title: 'the same reference without the listing is a finding',
    path: 'guide/intro.ts',
    text: ['the ', handbookReference, ' covers it'].join(''),
    localOnlyEntries: [],
    ownedFiles: [],
    expected: [{ line: 1, column: 5, kind: 'markdown', literal: handbookReference }],
  },
  {
    title: 'a remote markdown address stays clean',
    text: ['https://threejs.org/', 'x', '.md', ' explains it'].join(''),
    localOnlyEntries: [],
    ownedFiles: [],
    expected: [],
  },
  {
    title: 'every pointer in a text is reported with its position',
    text: [
      ['see ', docsFolder.value, 'plan'].join(''),
      ['also ', decisionNeedle].join(''),
      ['and ', taskIdNeedle].join(''),
      ['plus ', introReference].join(''),
    ].join('\n'),
    localOnlyEntries: docsEntries,
    ownedFiles: [],
    expected: [
      { line: 1, column: 5, kind: 'local-path', literal: docsFolder.value },
      { line: 2, column: 6, kind: 'decision', literal: decisionNeedle },
      { line: 3, column: 5, kind: 'task-id', literal: taskIdNeedle },
      { line: 4, column: 6, kind: 'markdown', literal: introReference },
    ],
  },
  {
    title: 'two pointers of one kind on one line are both reported',
    text: [decisionNeedle, ' and ', otherDecisionNeedle].join(''),
    localOnlyEntries: [],
    ownedFiles: [],
    expected: [
      { line: 1, column: 1, kind: 'decision', literal: decisionNeedle },
      { line: 1, column: 17, kind: 'decision', literal: otherDecisionNeedle },
    ],
  },
  {
    title: 'the same entry twice on one line is reported twice',
    text: [docsFolder.value, 'a and ', docsFolder.value, 'b'].join(''),
    localOnlyEntries: docsEntries,
    ownedFiles: [],
    expected: [
      { line: 1, column: 1, kind: 'local-path', literal: docsFolder.value },
      { line: 1, column: 12, kind: 'local-path', literal: docsFolder.value },
    ],
  },
  {
    title: 'pointers of several kinds on one line are all reported',
    text: ['see ', docsFolder.value, 'plan, ', decisionNeedle, ' and ', taskIdNeedle].join(''),
    localOnlyEntries: docsEntries,
    ownedFiles: [],
    expected: [
      { line: 1, column: 5, kind: 'local-path', literal: docsFolder.value },
      { line: 1, column: 16, kind: 'decision', literal: decisionNeedle },
      { line: 1, column: 32, kind: 'task-id', literal: taskIdNeedle },
    ],
  },
]
